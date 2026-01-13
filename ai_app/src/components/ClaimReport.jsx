import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Badge,
  Flex,
  useToast,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Icon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Image,
  CircularProgress,
  CircularProgressLabel,
  Grid
} from '@chakra-ui/react'
import { FiCheckCircle, FiXCircle, FiImage, FiVideo, FiDownload, FiMonitor, FiCamera, FiClock } from 'react-icons/fi'

const ClaimReport = ({ data, onReset }) => {
  const toast = useToast()
  
  // NEW: Processing state
  const [processingStatus, setProcessingStatus] = useState({})
  const [imageResults, setImageResults] = useState(null)
  const [videoResults, setVideoResults] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // NEW: Start processing when component mounts
  useEffect(() => {
    if (data && data.isProcessing) {
      setIsProcessing(true)
      startProcessing()
    } else if (data) {
      // If data already has results, use them
      setImageResults(data.imageResults)
      setVideoResults(data.videoResults)
      setIsProcessing(false)
    }
  }, [data])

  // NEW: Processing function
  const startProcessing = async () => {
    const { uploadedImages, uploadedVideos } = data

    // Initialize processing status for all files
    const initialStatus = {}
    if (uploadedImages) {
      uploadedImages.forEach(img => {
        initialStatus[img.id] = { progress: 0, status: 'processing' }
      })
    }
    if (uploadedVideos) {
      uploadedVideos.forEach(vid => {
        initialStatus[vid.id] = { progress: 0, status: 'processing' }
      })
    }
    setProcessingStatus(initialStatus)

    try {
      // Process images
      if (uploadedImages && uploadedImages.length > 0) {
        const imgResults = await processImages(uploadedImages)
        setImageResults(imgResults)
      }

      // Process videos
      if (uploadedVideos && uploadedVideos.length > 0) {
        const vidResults = await processVideos(uploadedVideos)
        setVideoResults(vidResults)
      }

      setIsProcessing(false)
    } catch (error) {
      console.error('Processing error:', error)
      setIsProcessing(false)
      toast({
        title: 'Processing failed',
        description: error.message || 'An error occurred during analysis',
        status: 'error',
        duration: 5000,
      })
    }
  }

  // NEW: Process images function
  const processImages = async (images) => {
    const IMAGE_API_URL = 'http://localhost:5000'
    
    // Simulate progress updates
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      setProcessingStatus(prev => ({
        ...prev,
        [img.id]: { progress: 33, status: 'processing' }
      }))
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setProcessingStatus(prev => ({
        ...prev,
        [img.id]: { progress: 66, status: 'processing' }
      }))
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    try {
      const formData = new FormData()
      formData.append('claimId', data.claimId)
      formData.append('notes', data.notes || '')
      
      images.forEach(image => {
        formData.append('files', image.file)
      })

      const response = await fetch(`${IMAGE_API_URL}/api/analyze-claim`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Image verification failed')
      }

      const results = await response.json()
      
      // Mark all images as complete
      images.forEach(img => {
        setProcessingStatus(prev => ({
          ...prev,
          [img.id]: { progress: 100, status: 'complete' }
        }))
      })
      
      return results
    } catch (error) {
      images.forEach(img => {
        setProcessingStatus(prev => ({
          ...prev,
          [img.id]: { progress: 100, status: 'error' }
        }))
      })
      throw error
    }
  }

  // NEW: Process videos function
  const processVideos = async (videos) => {
    const VIDEO_API_URL = 'http://localhost:8000'
    
    // Simulate progress updates
    for (let i = 0; i < videos.length; i++) {
      const vid = videos[i]
      setProcessingStatus(prev => ({
        ...prev,
        [vid.id]: { progress: 33, status: 'processing' }
      }))
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setProcessingStatus(prev => ({
        ...prev,
        [vid.id]: { progress: 66, status: 'processing' }
      }))
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    try {
      const formData = new FormData()
      videos.forEach(video => {
        formData.append('files', video.file)
      })

      const response = await fetch(`${VIDEO_API_URL}/api/verify-batch`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Video verification failed')
      }

      const results = await response.json()
      
      // Mark all videos as complete
      videos.forEach(vid => {
        setProcessingStatus(prev => ({
          ...prev,
          [vid.id]: { progress: 100, status: 'complete' }
        }))
      })
      
      return results
    } catch (error) {
      videos.forEach(vid => {
        setProcessingStatus(prev => ({
          ...prev,
          [vid.id]: { progress: 100, status: 'error' }
        }))
      })
      throw error
    }
  }

  if (!data) return null

  const { claimId, notes, uploadedImages, uploadedVideos } = data

  // FIXED: Create a mapping of filenames to preview URLs and file objects
  const imagePreviewMap = {}
  const videoPreviewMap = {}
  
  if (uploadedImages && Array.isArray(uploadedImages)) {
    uploadedImages.forEach(img => {
      if (img && img.name && img.preview) {
        imagePreviewMap[img.name] = img.preview
      }
    })
  }
  
  if (uploadedVideos && Array.isArray(uploadedVideos)) {
    uploadedVideos.forEach(vid => {
      if (vid && vid.name && vid.preview) {
        videoPreviewMap[vid.name] = vid.preview
      }
    })
  }

  const getRiskColorScheme = (risk) => {
    if (risk === 'Low') return 'green'
    if (risk === 'Medium') return 'yellow'
    return 'red'
  }

  const getAuthColorScheme = (auth) => {
    if (auth === 'Likely Genuine') return 'green'
    if (auth === 'AI Generated') return 'red'
    return 'gray'
  }

  // Calculate combined statistics
  const totalFiles = (uploadedImages?.length || 0) + (uploadedVideos?.length || 0)
  const totalAI = (imageResults?.aiDetectedCount || 0) + (videoResults?.aiDetectedCount || 0)
  const totalGenuine = (imageResults?.genuineCount || 0) + (videoResults?.genuineCount || 0)

  const getGeneratorFromDetails = (details) => {
    if (details?.generator) return details.generator
    if (details?.reason?.toLowerCase().includes('kling')) return 'Kling AI'
    if (details?.reason?.toLowerCase().includes('runway')) return 'Runway'
    if (details?.reason?.toLowerCase().includes('sora')) return 'Sora'
    if (details?.reason?.toLowerCase().includes('pika')) return 'Pika'
    return null
  }

  const formatImageDetails = (details) => {
    if (!details) return null
    
    const parts = []
    
    if (details.isScreenshot) {
      parts.push('Screenshot detected')
    }
    if (details.isCameraPhoto) {
      parts.push('Camera photo')
    }
    if (details.deviceInfo) {
      parts.push(`Device: ${details.deviceInfo}`)
    }
    
    return parts.length > 0 ? parts.join(' • ') : null
  }

  const handleExport = () => {
    const reportContent = `
COMBINED CLAIM ANALYSIS REPORT
====================================

Claim ID: ${claimId}
Generated: ${new Date().toLocaleString()}
${notes ? `Notes: ${notes}\n` : ''}

OVERALL SUMMARY
------------------------------------
Total Files: ${totalFiles}
  - Images: ${imageResults?.fileCount || 0}
  - Videos: ${videoResults?.fileCount || 0}
AI Detected: ${totalAI}
Genuine: ${totalGenuine}

${videoResults ? `
VIDEO ANALYSIS
------------------------------------
Risk Score: ${videoResults.riskScore}
Confidence: ${videoResults.confidence}%
Videos Analyzed: ${videoResults.fileCount}
AI Detected: ${videoResults.aiDetectedCount}
Genuine: ${videoResults.genuineCount}

Detailed Video Results:
${videoResults.results.map((item, idx) => `
${idx + 1}. ${item.filename}
   Status: ${item.authenticity}
   ${item.details.generator ? `Appears to be made using ${item.details.generator}` : 'Verified as genuine content'}
`).join('\n')}
` : ''}

${imageResults ? `
IMAGE ANALYSIS
------------------------------------
Risk Score: ${imageResults.riskScore}
Confidence: ${imageResults.confidence}%
Images Analyzed: ${imageResults.fileCount}
AI Detected: ${imageResults.aiDetectedCount}
Genuine: ${imageResults.genuineCount}

Detailed Image Results:
${imageResults.results.map((item, idx) => `
${idx + 1}. ${item.filename}
   Status: ${item.authenticity}
   ${formatImageDetails(item.details) || 'Standard image file'}
`).join('\n')}
` : ''}

====================================
Report generated by Claim Verification System
`
    const blob = new Blob([reportContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `combined-claim-report-${claimId}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Header */}
      <Box bg="white" borderBottom="1px" borderColor="gray.200">
        <Container maxW="container.xl" py={{ base: 3, md: 4 }} px={{ base: 4, md: 6 }}>
          <Heading size={{ base: "md", md: "lg" }} color="gray.900">Claim Analysis Report</Heading>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={{ base: 4, md: 8 }} px={{ base: 4, md: 6 }}>
        <VStack spacing={{ base: 4, md: 6 }} align="stretch">
          {/* Summary Card */}
          <Box bg="white" borderRadius="lg" border="1px" borderColor="gray.200" p={{ base: 4, md: 6 }}>
            <Flex 
              direction={{ base: "column", md: "row" }}
              justify="space-between" 
              align={{ base: "start", md: "start" }} 
              mb={4}
              gap={{ base: 2, md: 0 }}
            >
              <Box>
                <Heading size={{ base: "sm", md: "md" }} color="gray.900" mb={1}>
                  Claim Authenticity Summary
                </Heading>
                <Text fontSize={{ base: "xs", md: "sm" }} color="gray.500">
                  Claim ID: {claimId}
                </Text>
              </Box>
              <Text fontSize="xs" color="gray.500">
                {new Date().toLocaleString()}
              </Text>
            </Flex>

            {/* NEW: Processing indicator */}
            {isProcessing ? (
              <Box p={{ base: 4, md: 6 }} bg="blue.50" borderRadius="lg" textAlign="center" mb={4}>
                <Icon as={FiClock} boxSize={{ base: 10, md: 12 }} color="blue.600" mb={3} />
                <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="blue.900" mb={2}>
                  Processing Files...
                </Text>
                <Text fontSize={{ base: "xs", md: "sm" }} color="blue.700">
                  Analyzing {totalFiles} file{totalFiles !== 1 ? 's' : ''} through verification pipeline
                </Text>
              </Box>
            ) : (
              <>
                <HStack spacing={{ base: 2, md: 4 }} flexWrap={{ base: "wrap", md: "nowrap" }}>
                  <Box flex={1} minW={{ base: "full", sm: "150px" }} p={3} bg="red.50" borderRadius="md" border="1px" borderColor="red.200">
                    <Text fontSize={{ base: "xs", md: "sm" }} color="red.700" fontWeight="medium">Total AI Detected</Text>
                    <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="red.700">{totalAI}</Text>
                  </Box>
                  <Box flex={1} minW={{ base: "full", sm: "150px" }} p={3} bg="green.50" borderRadius="md" border="1px" borderColor="green.200">
                    <Text fontSize={{ base: "xs", md: "sm" }} color="green.700" fontWeight="medium">Total Genuine</Text>
                    <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="green.700">{totalGenuine}</Text>
                  </Box>
                  <Box flex={1} minW={{ base: "full", sm: "150px" }} p={3} bg="blue.50" borderRadius="md" border="1px" borderColor="blue.200">
                    <Text fontSize={{ base: "xs", md: "sm" }} color="blue.700" fontWeight="medium">Total Files</Text>
                    <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="blue.700">{totalFiles}</Text>
                  </Box>
                </HStack>
              </>
            )}

            {notes && (
              <Box mt={4} p={3} bg="blue.50" borderRadius="md" border="1px" borderColor="blue.200">
                <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="semibold" color="blue.900" mb={1}>
                  Additional Notes
                </Text>
                <Text fontSize={{ base: "xs", md: "sm" }} color="blue.700">
                  {notes}
                </Text>
              </Box>
            )}
          </Box>

          {/* NEW: Files Grid with Processing Status */}
          <Box bg="white" borderRadius="lg" border="1px" borderColor="gray.200" p={{ base: 4, md: 6 }}>
            <Heading size={{ base: "xs", md: "sm" }} color="gray.900" mb={4}>
              {isProcessing ? 'Processing Files' : 'Uploaded Files'}
            </Heading>
            
            <Grid templateColumns={{ base: "repeat(auto-fill, minmax(150px, 1fr))", md: "repeat(auto-fill, minmax(200px, 1fr))" }} gap={{ base: 3, md: 4 }}>
              {/* Images */}
              {uploadedImages && uploadedImages.map(img => {
                const status = processingStatus[img.id] || { progress: 0, status: 'pending' }
                const result = imageResults?.results?.find(r => r.filename === img.name)
                
                return (
                  <Box
                    key={img.id}
                    p={{ base: 3, md: 4 }}
                    bg="gray.50"
                    borderRadius="md"
                    border="1px"
                    borderColor="gray.200"
                    position="relative"
                  >
                    <Image
                      src={img.preview}
                      alt={img.name}
                      w="full"
                      h={{ base: "100px", md: "120px" }}
                      objectFit="cover"
                      borderRadius="md"
                      mb={3}
                    />
                    
                    <VStack spacing={2} align="stretch">
                      <Text fontSize="xs" fontWeight="medium" color="gray.900" noOfLines={1}>
                        {img.name}
                      </Text>
                      
                      <Flex justify="center" align="center">
                        {status.status === 'complete' && result ? (
                          <Badge colorScheme={getAuthColorScheme(result.authenticity)} fontSize="xs">
                            {result.authenticity}
                          </Badge>
                        ) : status.status === 'error' ? (
                          <Badge colorScheme="red" fontSize="xs">Error</Badge>
                        ) : (
                          <CircularProgress
                            value={status.progress}
                            size="40px"
                            color="blue.500"
                            thickness="8px"
                          >
                            <CircularProgressLabel fontSize="xs">
                              {status.progress}%
                            </CircularProgressLabel>
                          </CircularProgress>
                        )}
                      </Flex>
                    </VStack>
                  </Box>
                )
              })}

              {/* Videos */}
              {uploadedVideos && uploadedVideos.map(vid => {
                const status = processingStatus[vid.id] || { progress: 0, status: 'pending' }
                const result = videoResults?.results?.find(r => r.filename === vid.name)
                
                return (
                  <Box
                    key={vid.id}
                    p={{ base: 3, md: 4 }}
                    bg="gray.50"
                    borderRadius="md"
                    border="1px"
                    borderColor="gray.200"
                    position="relative"
                  >
                    <Flex
                      w="full"
                      h={{ base: "100px", md: "120px" }}
                      bg="gray.200"
                      borderRadius="md"
                      align="center"
                      justify="center"
                      mb={3}
                    >
                      <Icon as={FiVideo} boxSize={{ base: 10, md: 12 }} color="gray.500" />
                    </Flex>
                    
                    <VStack spacing={2} align="stretch">
                      <Text fontSize="xs" fontWeight="medium" color="gray.900" noOfLines={1}>
                        {vid.name}
                      </Text>
                      
                      <Flex justify="center" align="center">
                        {status.status === 'complete' && result ? (
                          <Badge colorScheme={getAuthColorScheme(result.authenticity)} fontSize="xs">
                            {result.authenticity}
                          </Badge>
                        ) : status.status === 'error' ? (
                          <Badge colorScheme="red" fontSize="xs">Error</Badge>
                        ) : (
                          <CircularProgress
                            value={status.progress}
                            size="40px"
                            color="purple.500"
                            thickness="8px"
                          >
                            <CircularProgressLabel fontSize="xs">
                              {status.progress}%
                            </CircularProgressLabel>
                          </CircularProgress>
                        )}
                      </Flex>
                    </VStack>
                  </Box>
                )
              })}
            </Grid>
          </Box>

          {/* Tabbed Analysis - Only show when processing is complete */}
          {!isProcessing && (imageResults || videoResults) && (
            <Box bg="white" borderRadius="lg" border="1px" borderColor="gray.200" overflow="hidden">
              <Tabs>
                <TabList overflowX="auto" overflowY="hidden">
                  {videoResults && (
                    <Tab fontSize={{ base: "sm", md: "md" }}>
                      <Icon as={FiVideo} mr={2} />
                      Videos ({videoResults.fileCount})
                    </Tab>
                  )}
                  {imageResults && (
                    <Tab fontSize={{ base: "sm", md: "md" }}>
                      <Icon as={FiImage} mr={2} />
                      Images ({imageResults.fileCount})
                    </Tab>
                  )}
                </TabList>

                <TabPanels>
                  {/* Video Results Tab */}
                  {videoResults && (
                    <TabPanel p={0}>
                      <Box px={{ base: 4, md: 6 }} py={4} borderBottom="1px" borderColor="gray.200" bg="purple.50">
                        <Flex 
                          direction={{ base: "column", md: "row" }}
                          justify="space-between" 
                          align={{ base: "start", md: "center" }}
                          gap={{ base: 3, md: 0 }}
                        >
                          <Box>
                            <Heading size={{ base: "xs", md: "sm" }} color="gray.900">Video Analysis</Heading>
                            <Text fontSize="xs" color="gray.600" mt={1}>
                              Multi-layer verification pipeline
                            </Text>
                          </Box>
                          <HStack spacing={4}>
                            <Box textAlign="center">
                              <Text fontSize="xs" color="gray.600">Risk</Text>
                              <Badge colorScheme={getRiskColorScheme(videoResults.riskScore)}>
                                {videoResults.riskScore}
                              </Badge>
                            </Box>
                            <Box textAlign="center">
                              <Text fontSize="xs" color="gray.600">Confidence</Text>
                              <Text fontSize="sm" fontWeight="bold">{videoResults.confidence}%</Text>
                            </Box>
                          </HStack>
                        </Flex>
                      </Box>

                      <Accordion allowMultiple>
                        {videoResults.results && videoResults.results.map((item, idx) => {
                          const generator = getGeneratorFromDetails(item.details)
                          const videoPreview = videoPreviewMap[item.filename]
                          
                          return (
                            <AccordionItem key={idx} border="none" borderBottom="1px" borderColor="gray.100">
                              <AccordionButton py={4} _hover={{ bg: 'gray.50' }}>
                                <Flex flex={1} align="center" gap={3}>
                                  <Icon
                                    as={item.finalStatus === 'PASSED' ? FiCheckCircle : FiXCircle}
                                    color={item.finalStatus === 'PASSED' ? 'green.500' : 'red.500'}
                                    boxSize={5}
                                  />
                                  <Box flex={1} textAlign="left">
                                    <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.900" noOfLines={1}>
                                      {item.filename}
                                    </Text>
                                    <HStack spacing={2} mt={1} flexWrap="wrap">
                                      <Badge colorScheme={getAuthColorScheme(item.authenticity)} fontSize="xs">
                                        {item.authenticity}
                                      </Badge>
                                      {generator && (
                                        <Badge colorScheme="orange" fontSize="xs">
                                          {generator}
                                        </Badge>
                                      )}
                                      <Text fontSize="xs" color="gray.500">
                                        {item.size ? (item.size / (1024 * 1024)).toFixed(2) : '0.00'} MB
                                      </Text>
                                    </HStack>
                                  </Box>
                                </Flex>
                                <AccordionIcon />
                              </AccordionButton>

                              <AccordionPanel pb={4} bg="gray.50">
                                <Flex 
                                  direction={{ base: "column", lg: "row" }}
                                  gap={4} 
                                  align="start"
                                >
                                  {videoPreview ? (
                                    <Box flex={{ base: "1", lg: "0 0 500px" }} w="full">
                                      <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                                        Video Preview
                                      </Text>
                                      <Box 
                                        width="100%" 
                                        bg="black" 
                                        borderRadius="md" 
                                        overflow="hidden"
                                        border="1px"
                                        borderColor="gray.300"
                                      >
                                        <video
                                          controls
                                          preload="metadata"
                                          style={{
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block',
                                            maxHeight: '400px'
                                          }}
                                          src={videoPreview}
                                        >
                                          Your browser does not support the video tag.
                                        </video>
                                      </Box>
                                    </Box>
                                  ) : (
                                    <Box flex={{ base: "1", lg: "0 0 500px" }} w="full" p={4} bg="gray.100" borderRadius="md" border="1px" borderColor="gray.300">
                                      <Text fontSize="sm" color="gray.600" textAlign="center">
                                        Video preview not available
                                      </Text>
                                    </Box>
                                  )}

                                  <Box flex="1" w="full">
                                    <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                                      Analysis Result
                                    </Text>
                                    {item.failedAtLayer ? (
                                      <Box p={4} bg="red.50" borderRadius="md" border="1px" borderColor="red.200">
                                        <Text fontSize="sm" color="red.700" fontWeight="medium" mb={2}>
                                          AI Content Detected
                                        </Text>
                                        <Text fontSize="sm" color="red.600">
                                          {generator ? `Appears to be made using ${generator}` : 'AI-generated content identified'}
                                        </Text>
                                      </Box>
                                    ) : (
                                      <Box p={4} bg="green.50" borderRadius="md" border="1px" borderColor="green.200">
                                        <Text fontSize="sm" color="green.700" fontWeight="medium">
                                          Genuine Content
                                        </Text>
                                      </Box>
                                    )}
                                  </Box>
                                </Flex>
                              </AccordionPanel>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    </TabPanel>
                  )}

                  {/* Image Results Tab */}
                  {imageResults && (
                    <TabPanel p={0}>
                      <Box px={{ base: 4, md: 6 }} py={4} borderBottom="1px" borderColor="gray.200" bg="blue.50">
                        <Flex 
                          direction={{ base: "column", md: "row" }}
                          justify="space-between" 
                          align={{ base: "start", md: "center" }}
                          gap={{ base: 3, md: 0 }}
                        >
                          <Box>
                            <Heading size={{ base: "xs", md: "sm" }} color="gray.900">Image Analysis</Heading>
                            <Text fontSize="xs" color="gray.600" mt={1}>
                              Processed through image verification pipeline
                            </Text>
                          </Box>
                          <HStack spacing={4}>
                            <Box textAlign="center">
                              <Text fontSize="xs" color="gray.600">Risk</Text>
                              <Badge colorScheme={getRiskColorScheme(imageResults.riskScore)}>
                                {imageResults.riskScore}
                              </Badge>
                            </Box>
                            <Box textAlign="center">
                              <Text fontSize="xs" color="gray.600">Confidence</Text>
                              <Text fontSize="sm" fontWeight="bold">{imageResults.confidence}%</Text>
                            </Box>
                          </HStack>
                        </Flex>
                      </Box>

                      <Accordion allowMultiple>
                        {imageResults.results && imageResults.results.map((item, idx) => {
                          const formattedDetails = formatImageDetails(item.details)
                          const imagePreview = imagePreviewMap[item.filename]
                          
                          return (
                            <AccordionItem key={idx} border="none" borderBottom="1px" borderColor="gray.100">
                              <AccordionButton py={4} _hover={{ bg: 'gray.50' }}>
                                <Flex flex={1} align="center" gap={3}>
                                  <Icon
                                    as={item.authenticity === 'Likely Genuine' ? FiCheckCircle : FiXCircle}
                                    color={item.authenticity === 'Likely Genuine' ? 'green.500' : 'red.500'}
                                    boxSize={5}
                                  />
                                  <Box flex={1} textAlign="left">
                                    <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.900" noOfLines={1}>
                                      {item.filename}
                                    </Text>
                                    <HStack spacing={2} mt={1} flexWrap="wrap">
                                      <Badge colorScheme={getAuthColorScheme(item.authenticity)} fontSize="xs">
                                        {item.authenticity}
                                      </Badge>
                                      {item.details?.isScreenshot && (
                                        <Badge colorScheme="purple" fontSize="xs" display="flex" alignItems="center" gap={1}>
                                          <Icon as={FiMonitor} boxSize={3} />
                                          Screenshot
                                        </Badge>
                                      )}
                                      {item.details?.isCameraPhoto && (
                                        <Badge colorScheme="blue" fontSize="xs" display="flex" alignItems="center" gap={1}>
                                          <Icon as={FiCamera} boxSize={3} />
                                          Camera
                                        </Badge>
                                      )}
                                      <Text fontSize="xs" color="gray.500">
                                        {item.size ? (item.size / (1024 * 1024)).toFixed(2) : '0.00'} MB
                                      </Text>
                                    </HStack>
                                  </Box>
                                </Flex>
                                <AccordionIcon />
                              </AccordionButton>

                              <AccordionPanel pb={4} bg="gray.50">
                                <Flex 
                                  direction={{ base: "column", lg: "row" }}
                                  gap={4} 
                                  align="start"
                                >
                                  {imagePreview ? (
                                    <Box flex={{ base: "1", lg: "0 0 500px" }} w="full">
                                      <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                                        Image Preview
                                      </Text>
                                      <Image
                                        src={imagePreview}
                                        alt={item.filename}
                                        width="100%"
                                        borderRadius="md"
                                        border="1px"
                                        borderColor="gray.300"
                                        objectFit="contain"
                                        maxH="400px"
                                        fallback={
                                          <Box 
                                            width="100%" 
                                            p={8} 
                                            bg="gray.100" 
                                            borderRadius="md" 
                                            border="1px" 
                                            borderColor="gray.300"
                                            textAlign="center"
                                          >
                                            <Text fontSize="sm" color="gray.600">
                                              Unable to load image preview
                                            </Text>
                                          </Box>
                                        }
                                      />
                                    </Box>
                                  ) : (
                                    <Box flex={{ base: "1", lg: "0 0 500px" }} w="full" p={4} bg="gray.100" borderRadius="md" border="1px" borderColor="gray.300">
                                      <Text fontSize="sm" color="gray.600" textAlign="center">
                                        Image preview not available
                                      </Text>
                                    </Box>
                                  )}

                                  <Box flex="1" w="full">
                                    <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                                      Analysis Result
                                    </Text>
                                    {item.authenticity === 'AI Generated' ? (
                                      <Box p={4} bg="red.50" borderRadius="md" border="1px" borderColor="red.200">
                                        <Text fontSize="sm" color="red.700" fontWeight="medium">
                                          AI Content Detected
                                        </Text>
                                      </Box>
                                    ) : (
                                      <Box p={4} bg="green.50" borderRadius="md" border="1px" borderColor="green.200">
                                        <Text fontSize="sm" color="green.700" fontWeight="medium" mb={2}>
                                          Genuine Content
                                        </Text>
                                        {formattedDetails && (
                                          <HStack spacing={3} mt={2} flexWrap="wrap">
                                            {item.details?.isScreenshot && (
                                              <Flex align="center" gap={2}>
                                                <Icon as={FiMonitor} color="green.600" boxSize={4} />
                                                <Text fontSize="xs" color="green.600">Screenshot detected</Text>
                                              </Flex>
                                            )}
                                            {item.details?.isCameraPhoto && (
                                              <Flex align="center" gap={2}>
                                                <Icon as={FiCamera} color="green.600" boxSize={4} />
                                                <Text fontSize="xs" color="green.600">Camera photo</Text>
                                              </Flex>
                                            )}
                                          </HStack>
                                        )}
                                        {item.details?.deviceInfo && (
                                          <Text fontSize="xs" color="green.600" mt={2}>
                                            Device: {item.details.deviceInfo}
                                          </Text>
                                        )}
                                      </Box>
                                    )}
                                  </Box>
                                </Flex>
                              </AccordionPanel>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    </TabPanel>
                  )}
                </TabPanels>
              </Tabs>
            </Box>
          )}

          {/* Actions */}
          <HStack spacing={3} flexWrap={{ base: "wrap", md: "nowrap" }}>
            <Button 
              colorScheme="blue" 
              onClick={onReset}
              w={{ base: "full", md: "auto" }}
              size={{ base: "md", md: "md" }}
            >
              Analyze New Claim
            </Button>
            {!isProcessing && (
              <Button 
                variant="outline" 
                leftIcon={<FiDownload />} 
                onClick={handleExport}
                w={{ base: "full", md: "auto" }}
                size={{ base: "md", md: "md" }}
              >
                Export Combined Report
              </Button>
            )}
          </HStack>
        </VStack>
      </Container>
    </>
  )
}

export default ClaimReport