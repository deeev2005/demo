import { useState } from 'react'
import { Box } from '@chakra-ui/react'
import ClaimUpload from './components/ClaimUpload'
import ClaimReport from './components/ClaimReport'

function App() {
  const [screen, setScreen] = useState('upload')
  const [reportData, setReportData] = useState(null)

  const handleClaimSubmit = async (data) => {
    console.log('Received data from ClaimUpload:', data)
    
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
  }

  const handleReset = () => {
    setScreen('upload')
    setReportData(null)
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {screen === 'upload' && <ClaimUpload onSubmit={handleClaimSubmit} />}
      {screen === 'report' && <ClaimReport data={reportData} onReset={handleReset} />}
    </Box>
  )
}

export default App