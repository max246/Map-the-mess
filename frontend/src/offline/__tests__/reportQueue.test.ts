const mockPost = jest.fn()
const mockPatch = jest.fn()

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}))

// Mock idb with an in-memory store. We test our queue logic, not IDB internals.
type Row = { id: string; [key: string]: unknown }
const stores = new Map<string, Map<string, Row>>()
const getStore = (name: string) => {
  let s = stores.get(name)
  if (!s) {
    s = new Map()
    stores.set(name, s)
  }
  return s
}

jest.mock('idb', () => ({
  __esModule: true,
  openDB: jest.fn(async (_dbName: string, _version: number) => ({
    getAll: async (storeName: string) => Array.from(getStore(storeName).values()),
    get: async (storeName: string, id: string) => getStore(storeName).get(id),
    put: async (storeName: string, value: Row) => {
      getStore(storeName).set(value.id, value)
      return value.id
    },
    delete: async (storeName: string, id: string) => {
      getStore(storeName).delete(id)
    },
    clear: async (storeName: string) => {
      getStore(storeName).clear()
    },
    objectStoreNames: { contains: () => true },
  })),
}))

// The queue module reads `indexedDB` at module load to decide whether it's in a browser.
if (typeof (globalThis as { indexedDB?: unknown }).indexedDB === 'undefined') {
  ;(globalThis as { indexedDB: unknown }).indexedDB = {}
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))

const loadQueue = async () => {
  jest.resetModules()
  return await import('../reportQueue')
}

describe('reportQueue', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockPatch.mockReset()
    stores.clear()
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })
  })

  const sampleBody = {
    latitude: 51.5,
    longitude: -0.12,
    report_type: 'litter',
    description: 'Test report',
  }

  const makePhoto = (size = 10) => new Blob([new Uint8Array(size)], { type: 'image/jpeg' })

  it('enqueues a report and lists it back', async () => {
    const queue = await loadQueue()
    const record = await queue.enqueue({ body: sampleBody, photos: [] })
    expect(record.id).toBeTruthy()
    expect(record.status).toBe('pending')

    const items = await queue.list()
    expect(items).toHaveLength(1)
    expect(items[0].body).toEqual(sampleBody)
  })

  it('removes a queued report', async () => {
    const queue = await loadQueue()
    const record = await queue.enqueue({ body: sampleBody, photos: [] })
    await queue.remove(record.id)
    const items = await queue.list()
    expect(items).toHaveLength(0)
  })

  it('flush posts the report and clears the queue on success', async () => {
    const queue = await loadQueue()
    mockPost.mockResolvedValue({ data: { id: 'server-1' } })

    await queue.enqueue({ body: sampleBody, photos: [makePhoto()] })
    const result = await queue.flush()

    expect(result).toEqual({ synced: 1, failed: 0 })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost.mock.calls[0][0]).toBe('/api/reports/')
    const items = await queue.list()
    expect(items).toHaveLength(0)
  })

  it('uploads extra photos via the images endpoint', async () => {
    const queue = await loadQueue()
    mockPost
      .mockResolvedValueOnce({ data: { id: 'server-2' } })
      .mockResolvedValueOnce({ data: { id: 'img-1' } })
      .mockResolvedValueOnce({ data: { id: 'img-2' } })

    await queue.enqueue({
      body: sampleBody,
      photos: [makePhoto(), makePhoto(), makePhoto()],
    })
    const result = await queue.flush()

    expect(result).toEqual({ synced: 1, failed: 0 })
    expect(mockPost).toHaveBeenCalledTimes(3)
    expect(mockPost.mock.calls[0][0]).toBe('/api/reports/')
    expect(mockPost.mock.calls[1][0]).toBe('/api/reports/server-2/images')
    expect(mockPost.mock.calls[2][0]).toBe('/api/reports/server-2/images')
  })

  it('keeps a report pending on a network-layer error', async () => {
    const queue = await loadQueue()
    const networkErr = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
    mockPost.mockRejectedValue(networkErr)

    await queue.enqueue({ body: sampleBody, photos: [] })
    const result = await queue.flush()

    expect(result.synced).toBe(0)
    const items = await queue.list()
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('pending')
    expect(items[0].attempts).toBe(0)
  })

  it('marks a report as failed on a server error response', async () => {
    const queue = await loadQueue()
    const httpErr = Object.assign(new Error('Server error'), {
      response: { status: 500, data: {} },
    })
    mockPost.mockRejectedValue(httpErr)

    await queue.enqueue({ body: sampleBody, photos: [] })
    const result = await queue.flush()

    expect(result.failed).toBe(1)
    const items = await queue.list()
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('failed')
    expect(items[0].attempts).toBe(1)
    expect(items[0].lastError).toBe('Server error')
  })

  it('does nothing when offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })
    const queue = await loadQueue()
    await queue.enqueue({ body: sampleBody, photos: [] })
    const result = await queue.flush()

    expect(result).toEqual({ synced: 0, failed: 0 })
    expect(mockPost).not.toHaveBeenCalled()
    const items = await queue.list()
    expect(items).toHaveLength(1)
  })

  it('notifies subscribers with flushing + progress snapshots', async () => {
    const queue = await loadQueue()
    mockPost.mockResolvedValue({ data: { id: 'server-3' } })

    const snapshots: Array<{ flushing: boolean; total?: number; completed?: number }> = []
    const unsubscribe = queue.subscribe((s) => {
      snapshots.push({
        flushing: s.flushing,
        total: s.progress?.total,
        completed: s.progress?.completed,
      })
    })

    await queue.enqueue({ body: sampleBody, photos: [makePhoto()] })
    await queue.flush()
    await flushMicrotasks()
    unsubscribe()

    const wasFlushing = snapshots.some((s) => s.flushing === true)
    const sawCompletion = snapshots.some((s) => s.flushing === false)
    expect(wasFlushing).toBe(true)
    expect(sawCompletion).toBe(true)
  })

  it('enqueues a resolve action and flushes it via image uploads + clean PATCH', async () => {
    const queue = await loadQueue()
    mockPatch.mockResolvedValue({ data: { id: 'report-99', status: 'cleaned' } })
    mockPost.mockResolvedValue({ data: { id: 'img-1' } })

    await queue.enqueueResolve({ reportId: 'report-99', photos: [makePhoto(), makePhoto()] })
    const result = await queue.flush()

    expect(result).toEqual({ synced: 1, failed: 0 })
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPost.mock.calls[0][0]).toBe('/api/reports/report-99/images')
    expect(mockPost.mock.calls[1][0]).toBe('/api/reports/report-99/images')
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPatch.mock.calls[0][0]).toBe('/api/reports/report-99/clean')
    const items = await queue.list()
    expect(items).toHaveLength(0)
  })

  it('keeps a resolve action pending on a 401 auth error', async () => {
    const queue = await loadQueue()
    const authErr = Object.assign(new Error('Unauthorized'), {
      response: { status: 401, data: {} },
    })
    mockPost.mockRejectedValue(authErr)

    await queue.enqueueResolve({ reportId: 'report-42', photos: [makePhoto()] })
    const result = await queue.flush()

    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)
    const items = await queue.list()
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('pending')
    expect(items[0].attempts).toBe(0)
  })

  it('normalizes legacy rows (no kind field) as create', async () => {
    // Seed the store directly with a legacy-shaped row.
    getStore('pending_reports').set('legacy-1', {
      id: 'legacy-1',
      createdAt: 1,
      status: 'pending',
      attempts: 0,
      body: sampleBody,
      photos: [],
    })
    const queue = await loadQueue()
    const items = await queue.list()
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('create')
  })

  it('dedups concurrent flush calls', async () => {
    const queue = await loadQueue()
    let resolvePost!: (value: unknown) => void
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve
        })
    )

    await queue.enqueue({ body: sampleBody, photos: [] })
    const first = queue.flush()
    const second = queue.flush()

    // Wait for the flush to reach the mocked post call.
    while (!resolvePost) await flushMicrotasks()

    resolvePost({ data: { id: 'server-4' } })
    const [r1, r2] = await Promise.all([first, second])

    expect(r1).toEqual(r2)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })
})
