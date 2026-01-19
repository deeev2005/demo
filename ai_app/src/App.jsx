import { useState, useRef, useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import ClaimUpload from './components/ClaimUpload'
import ClaimReport from './components/ClaimReport'
import LoginPage from './components/LoginPage'

function App() {
  const [screen, setScreen] = useState('upload')
  const [reportData, setReportData] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const isProcessingRef = useRef(false)

  // Check if already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      setIsLoggedIn(true)
    }
  }, [])

  const handleLogin = () => {
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('company')
    setIsLoggedIn(false)
    setScreen('upload')
    setReportData(null)
  }

  const handleClaimSubmit = async (data) => {
    // CRITICAL FIX: Prevent duplicate calls
    if (isProcessingRef.current) {
      console.log('Already processing submission, ignoring duplicate call')
      return
    }

    isProcessingRef.current = true
    console.log('Processing claim submission:', data)
    
    try {
      // Go directly to report screen with uploaded files
      setReportData({
        claimId: data.claimId,
        notes: data.notes,
        uploadedImages: data.uploadedImages || [],
        uploadedVideos: data.uploadedVideos || [],
        processedAt: data.processedAt,
        // These will be populated as processing completes
        imageResults: null,
        videoResults: null,
        isProcessing: true
      })
      setScreen('report')
    } finally {
      // Reset the flag after a short delay to allow screen transition
      setTimeout(() => {
        isProcessingRef.current = false
      }, 1000)
    }
  }

  const handleReset = () => {
    isProcessingRef.current = false
    setScreen('upload')
    setReportData(null)
  }

  // Show login page if not authenticated
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {screen === 'upload' && <ClaimUpload onSubmit={handleClaimSubmit} onLogout={handleLogout} />}
      {screen === 'report' && <ClaimReport data={reportData} onReset={handleReset} onLogout={handleLogout} />}
    </Box>
  )
}

export default App