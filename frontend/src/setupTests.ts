import '@testing-library/jest-dom'

jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => null,
  HelmetProvider: ({ children }: { children?: React.ReactNode }) => children,
}))
