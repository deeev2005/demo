import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  colors: {
    brand: {
      50: '#e3f2fd',
      100: '#bbdefb',
      500: '#2196f3',
      600: '#1e88e5',
      700: '#1976d2',
    },
  },
  fonts: {
    heading: `'Inter', -apple-system, system-ui, sans-serif`,
    body: `'Inter', -apple-system, system-ui, sans-serif`,
  },
})

export default theme