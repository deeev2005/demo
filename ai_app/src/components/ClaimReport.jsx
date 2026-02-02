import React, { useState, useEffect, useRef } from 'react'
import { keyframes } from '@emotion/react'
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
  Grid,
  Divider,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/react'
import { FiCheckCircle, FiXCircle, FiImage, FiVideo, FiDownload, FiMonitor, FiCamera, FiClock, FiInfo } from 'react-icons/fi'
import jsPDF from 'jspdf'

// Sand clock animation
const sandClockRotate = keyframes`
  0% { transform: rotate(0deg); }
  50% { transform: rotate(180deg); }
  100% { transform: rotate(360deg); }
`

const SandClockIcon = () => (
  <Box
    animation={`${sandClockRotate} 2s linear infinite`}
    display="inline-block"
  >
    <Icon as={FiClock} boxSize={10} color="blue.500" />
  </Box>
)

const ClaimReport = ({ data, onReset }) => {
  const toast = useToast()
  
  const [processingStatus, setProcessingStatus] = useState({})
  const [imageResults, setImageResults] = useState(null)
  const [videoResults, setVideoResults] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const hasProcessedRef = useRef(false)
  const currentClaimIdRef = useRef(null)

  useEffect(() => {
    // Reset if it's a new claim
    if (data && data.claimId !== currentClaimIdRef.current) {
      hasProcessedRef.current = false
      currentClaimIdRef.current = data.claimId
      setImageResults(null)
      setVideoResults(null)
    }

    if (data && data.isProcessing && !hasProcessedRef.current) {
      hasProcessedRef.current = true
      setIsProcessing(true)
      startProcessing()
    } else if (data && !data.isProcessing) {
      setImageResults(data.imageResults)
      setVideoResults(data.videoResults)
      setIsProcessing(false)
    }
  }, [data])

  const startProcessing = async () => {
    const { uploadedImages, uploadedVideos } = data

    const initialStatus = {}
    if (uploadedImages) {
      uploadedImages.forEach(img => {
        initialStatus[img.id] = { status: 'processing' }
      })
    }
    if (uploadedVideos) {
      uploadedVideos.forEach(vid => {
        initialStatus[vid.id] = { status: 'processing' }
      })
    }
    setProcessingStatus(initialStatus)

    try {
      const promises = []

      if (uploadedImages && uploadedImages.length > 0) {
        promises.push(processImages(uploadedImages))
      }

      if (uploadedVideos && uploadedVideos.length > 0) {
        promises.push(processVideos(uploadedVideos))
      }

      await Promise.all(promises)

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

  const processImages = async (images) => {
    const IMAGE_API_URL = import.meta.env.VITE_IMAGE_API_URL || 'http://localhost:5000'
    
    console.log(`=== Processing ${images.length} images in single batch ===`)

    try {
      const formData = new FormData()
      formData.append('claimId', data.claimId)
      formData.append('notes', data.notes || '')
      
      images.forEach(image => {
        formData.append('files', image.file)
      })

      // GET JWT TOKEN FROM localStorage
      const token = localStorage.getItem('authToken')

      if (!token) {
        throw new Error('Authentication token not found. Please login again.')
      }

      const response = await fetch(`${IMAGE_API_URL}/api/analyze-claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const result = await response.json()
      
      const aiCount = result.results.filter(r => r.authenticity === 'AI Generated').length
      const genuineCount = result.results.length - aiCount
      
      setImageResults({
        claimId: data.claimId,
        processedAt: new Date().toISOString(),
        notes: data.notes,
        results: result.results,
        fileCount: result.results.length,
        imageCount: result.results.length,
        aiDetectedCount: aiCount,
        genuineCount: genuineCount,
        riskScore: aiCount > genuineCount ? 'High' : aiCount > 0 ? 'Medium' : 'Low'
      })
      
      images.forEach(image => {
        setProcessingStatus(prev => ({
          ...prev,
          [image.id]: { status: 'complete' }
        }))
      })
      
      console.log(`=== Completed processing ${images.length} images ===`)
      
    } catch (error) {
      console.error('Image processing error:', error)
      images.forEach(image => {
        setProcessingStatus(prev => ({
          ...prev,
          [image.id]: { status: 'error' }
        }))
      })
      
      toast({
        title: 'Image processing failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    }
  }

  const processVideos = async (videos) => {
    const VIDEO_API_URL = import.meta.env.VITE_VIDEO_API_URL || 'http://localhost:8000'
    
    console.log(`=== Processing ${videos.length} videos in single batch ===`)

    try {
      const formData = new FormData()
      
      videos.forEach(video => {
        formData.append('files', video.file)
      })

      // GET JWT TOKEN FROM localStorage
      const token = localStorage.getItem('authToken')

      if (!token) {
        throw new Error('Authentication token not found. Please login again.')
      }

      const response = await fetch(`${VIDEO_API_URL}/api/verify-batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const result = await response.json()
      
      const aiCount = result.results.filter(r => r.authenticity === 'AI Generated').length
      const genuineCount = result.results.length - aiCount
      
      setVideoResults({
        results: result.results,
        fileCount: result.results.length,
        videoCount: result.results.length,
        aiDetectedCount: aiCount,
        genuineCount: genuineCount,
        riskScore: aiCount > genuineCount ? 'High' : aiCount > 0 ? 'Medium' : 'Low'
      })
      
      videos.forEach(video => {
        setProcessingStatus(prev => ({
          ...prev,
          [video.id]: { status: 'complete' }
        }))
      })
      
      console.log(`=== Completed processing ${videos.length} videos ===`)
      
    } catch (error) {
      console.error('Video processing error:', error)
      videos.forEach(video => {
        setProcessingStatus(prev => ({
          ...prev,
          [video.id]: { status: 'error' }
        }))
      })
      
      toast({
        title: 'Video processing failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    }
  }

  if (!data) return null

  const { claimId, notes, uploadedImages, uploadedVideos } = data

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

  const getAuthColorScheme = (auth, verdict) => {
    if (verdict === 'Digitally Edited') return 'yellow'
    if (auth === 'Likely Genuine') return 'green'
    if (auth === 'AI Generated') return 'red'
    return 'gray'
  }

  const totalFiles = (uploadedImages?.length || 0) + (uploadedVideos?.length || 0)
  const totalAI = (imageResults?.aiDetectedCount || 0) + (videoResults?.aiDetectedCount || 0)
  const totalGenuine = (imageResults?.genuineCount || 0) + (videoResults?.genuineCount || 0)

  const getGeneratorFromDetails = (details) => {
    if (details?.generator) return details.generator
    if (details?.reason?.toLowerCase().includes('kling')) return 'Kling AI'
    if (details?.reason?.toLowerCase().includes('runway')) return 'Runway'
    if (details?.reason?.toLowerCase().includes('sora')) return 'Sora'
    if (details?.reason?.toLowerCase().includes('pika')) return 'Pika'
    if (details?.reason?.toLowerCase().includes('firefly')) return 'Firefly'
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

  const getFailedLayerInfo = (layerResults) => {
    if (!layerResults || layerResults.length === 0) return null
    
    const failedLayer = layerResults.find(layer => !layer.passed)
    if (!failedLayer) return null
    
    return failedLayer
  }

  const cleanReasonText = (reason) => {
    if (!reason) return ''
    
    let cleaned = reason.replace(/Filename contains AI generator pattern:\s*/i, '')
    cleaned = cleaned.replace(/TruthScan detected AI generation with [\d.]+% AI probability,?\s*/i, '')
    cleaned = cleaned.replace(/AI-generated metadata detected:\s*/i, '')
    
    return cleaned.trim()
  }

  const getImageGeneratorFromDetails = (failedLayer) => {
    if (!failedLayer) return null
    
    // First check if generator field exists (from Layer 2 metadata)
    if (failedLayer.generator) {
      return failedLayer.generator
    }
    
    // Then check reason text (from Layer 1 filename detection)
    if (!failedLayer.reason) return null
    
    const reason = failedLayer.reason.toLowerCase()
    if (reason.includes('midjourney')) return 'Midjourney'
    if (reason.includes('dall-e') || reason.includes('dalle')) return 'DALL-E'
    if (reason.includes('stable diffusion')) return 'Stable Diffusion'
    if (reason.includes('firefly')) return 'Adobe Firefly'
    if (reason.includes('leonardo')) return 'Leonardo AI'
    if (reason.includes('gemini')) return 'Gemini'
    if (reason.includes('grok')) return 'Grok AI'
    if (reason.includes('flux')) return 'Flux'
    if (reason.includes('chatgpt') || reason.includes('gpt-4')) return 'ChatGPT/GPT-4'
    
    return null
  }

  const formatImageExportDetails = (item) => {
    const failedLayer = getFailedLayerInfo(item.layerResults)
    
    if (!failedLayer) {
      return '   Verified as genuine content'
    }
    
    let details = []
    
    if (failedLayer.verdict) {
      details.push(`Verdict: ${failedLayer.verdict}`)
    }
    
    if (failedLayer.aiPercentage !== undefined) {
      details.push(`AI Probability: ${failedLayer.aiPercentage}%`)
    }
    
    if (failedLayer.humanPercentage !== undefined) {
      details.push(`Human Probability: ${failedLayer.humanPercentage}%`)
    }
    
    if (failedLayer.confidence) {
      details.push(`Probability Level: ${failedLayer.confidence}`)
    }
    
    const generator = getImageGeneratorFromDetails(failedLayer)
    if (generator) {
      details.push(`Appears to be made using ${generator}`)
    }
    
    return details.length > 0 ? '   ' + details.join('\n   ') : '   AI-generated content detected'
  }

  const formatVideoExportDetails = (item) => {
    if (!item.details) {
      return '   Verified as genuine content'
    }
    
    let details = []
    
    if (item.details.verdict) {
      details.push(`Verdict: ${item.details.verdict}`)
    }
    
    if (item.details.aiPercentage !== undefined) {
      details.push(`AI Probability: ${item.details.aiPercentage}%`)
    }
    
    if (item.details.humanPercentage !== undefined) {
      details.push(`Human Probability: ${item.details.humanPercentage}%`)
    }
    
    if (item.details.confidence) {
      details.push(`Probability Level: ${item.details.confidence}`)
    }
    
    const generator = getGeneratorFromDetails(item.details)
    if (generator) {
      details.push(`Appears to be made using ${generator}`)
    }
    
    return details.length > 0 ? '   ' + details.join('\n   ') : '   AI-generated content detected'
  }

  const handleExport = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      let yPos = 20
      const pageHeight = pdf.internal.pageSize.height
      const pageWidth = pdf.internal.pageSize.width
      const margin = 15
      const maxWidth = pageWidth - 2 * margin
      const IMAGE_API_URL = import.meta.env.VITE_IMAGE_API_URL || 'http://localhost:5000'

      // Helper function to check if we need a new page
      const checkPageBreak = (requiredSpace) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          pdf.addPage()
          yPos = 20
          return true
        }
        return false
      }

      // Helper function to convert image URL to base64
      const getBase64FromUrl = async (url) => {
        try {
          // If it's a heatmap URL from backend, fetch with auth token
          if (url && url.includes('/heatmaps/')) {
            const token = localStorage.getItem('authToken')
            const fullUrl = url.startsWith('http') ? url : `${IMAGE_API_URL}${url}`
            
            const response = await fetch(fullUrl, {
              headers: token ? {
                'Authorization': `Bearer ${token}`
              } : {}
            })
            
            if (!response.ok) {
              console.error('Failed to fetch heatmap:', response.status)
              return null
            }
            
            const blob = await response.blob()
            return new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
          } else if (url) {
            // For other URLs (like image previews)
            const response = await fetch(url)
            const blob = await response.blob()
            return new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
          }
          return null
        } catch (error) {
          console.error('Error converting image:', error)
          return null
        }
      }

      // Title
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      pdf.text('COMBINED CLAIM ANALYSIS REPORT', margin, yPos)
      yPos += 10

      // Claim Info
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Claim ID: ${claimId}`, margin, yPos)
      yPos += 6
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos)
      yPos += 6
      
      if (notes) {
        pdf.text(`Notes: ${notes}`, margin, yPos)
        yPos += 8
      } else {
        yPos += 2
      }

      // Overall Summary
      checkPageBreak(30)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('OVERALL SUMMARY', margin, yPos)
      yPos += 8

      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Total Files: ${totalFiles}`, margin, yPos)
      yPos += 6
      pdf.text(`  - Images: ${imageResults?.fileCount || 0}`, margin, yPos)
      yPos += 6
      pdf.text(`  - Videos: ${videoResults?.fileCount || 0}`, margin, yPos)
      yPos += 6
      pdf.text(`AI Detected: ${totalAI}`, margin, yPos)
      yPos += 6
      pdf.text(`Genuine: ${totalGenuine}`, margin, yPos)
      yPos += 12

      // Video Analysis
      if (videoResults && videoResults.results && videoResults.results.length > 0) {
        checkPageBreak(30)
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.text('VIDEO ANALYSIS', margin, yPos)
        yPos += 8

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`Videos Analyzed: ${videoResults.fileCount}`, margin, yPos)
        yPos += 6
        pdf.text(`AI Detected: ${videoResults.aiDetectedCount}`, margin, yPos)
        yPos += 6
        pdf.text(`Genuine: ${videoResults.genuineCount}`, margin, yPos)
        yPos += 10

        pdf.setFont('helvetica', 'bold')
        pdf.text('Detailed Video Results:', margin, yPos)
        yPos += 8

        for (let i = 0; i < videoResults.results.length; i++) {
          const item = videoResults.results[i]
          checkPageBreak(30)

          pdf.setFont('helvetica', 'bold')
          pdf.text(`${i + 1}. ${item.filename}`, margin, yPos)
          yPos += 6

          pdf.setFont('helvetica', 'normal')
          pdf.text(`   Status: ${item.authenticity}`, margin, yPos)
          yPos += 6

          const details = formatVideoExportDetails(item)
          const detailLines = pdf.splitTextToSize(details, maxWidth - 5)
          detailLines.forEach(line => {
            checkPageBreak(6)
            pdf.text(line, margin, yPos)
            yPos += 6
          })

          yPos += 4
        }

        yPos += 6
      }

      // Image Analysis
      if (imageResults && imageResults.results && imageResults.results.length > 0) {
        checkPageBreak(30)
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.text('IMAGE ANALYSIS', margin, yPos)
        yPos += 8

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`Images Analyzed: ${imageResults.fileCount}`, margin, yPos)
        yPos += 6
        pdf.text(`AI Detected: ${imageResults.aiDetectedCount}`, margin, yPos)
        yPos += 6
        pdf.text(`Genuine: ${imageResults.genuineCount}`, margin, yPos)
        yPos += 10

        pdf.setFont('helvetica', 'bold')
        pdf.text('Detailed Image Results:', margin, yPos)
        yPos += 8

        for (let i = 0; i < imageResults.results.length; i++) {
          const item = imageResults.results[i]
          const failedLayer = getFailedLayerInfo(item.layerResults)
          
          checkPageBreak(80)

          pdf.setFont('helvetica', 'bold')
          pdf.text(`${i + 1}. ${item.filename}`, margin, yPos)
          yPos += 6

          pdf.setFont('helvetica', 'normal')
          pdf.text(`   Status: ${item.authenticity}`, margin, yPos)
          yPos += 6

          const details = formatImageExportDetails(item)
          const detailLines = pdf.splitTextToSize(details, maxWidth - 5)
          detailLines.forEach(line => {
            checkPageBreak(6)
            pdf.text(line, margin, yPos)
            yPos += 6
          })

          // Add image preview
          const imagePreview = imagePreviewMap[item.filename]
          if (imagePreview) {
            checkPageBreak(60)
            yPos += 4
            try {
              const base64Image = await getBase64FromUrl(imagePreview)
              if (base64Image) {
                const imgWidth = 80
                const imgHeight = 60
                pdf.addImage(base64Image, 'JPEG', margin, yPos, imgWidth, imgHeight)
                yPos += imgHeight + 4
              }
            } catch (error) {
              console.error('Error adding image to PDF:', error)
            }
          }

          // Add heatmap if available
          if (failedLayer && failedLayer.heatmapUrl) {
            checkPageBreak(60)
            yPos += 4
            pdf.setFont('helvetica', 'italic')
            pdf.setFontSize(9)
            pdf.text('AI Detection Heatmap:', margin, yPos)
            yPos += 6
            
            try {
              const base64Heatmap = await getBase64FromUrl(failedLayer.heatmapUrl)
              if (base64Heatmap) {
                const imgWidth = 80
                const imgHeight = 60
                pdf.addImage(base64Heatmap, 'PNG', margin, yPos, imgWidth, imgHeight)
                yPos += imgHeight + 4
              }
            } catch (error) {
              console.error('Error adding heatmap to PDF:', error)
            }
            pdf.setFontSize(10)
          }

          yPos += 6
        }
      }

      // Save the PDF
      pdf.save(`combined-claim-report-${claimId}-${Date.now()}.pdf`)
      
      toast({
        title: 'PDF exported successfully',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({
        title: 'PDF export failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    }
  }

  return (
    <>
      <Box bg="white" borderBottom="1px" borderColor="gray.200">
        <Container maxW="container.xl" py={{ base: 3, md: 4 }} px={{ base: 4, md: 6 }}>
          <Heading size={{ base: "md", md: "lg" }} color="gray.900">Claim Analysis Report</Heading>
        </Container>
      </Box>

      <Container maxW="container.xl" py={{ base: 4, md: 8 }} px={{ base: 4, md: 6 }}>
        <VStack spacing={{ base: 4, md: 6 }} align="stretch">
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
                    <Text fontSize={{ base: "xs", md: "sm" }} color="red.700" fontWeight="medium">Total Flagged</Text>
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

          <Box bg="white" borderRadius="lg" border="1px" borderColor="gray.200" p={{ base: 4, md: 6 }}>
            <Heading size={{ base: "xs", md: "sm" }} color="gray.900" mb={4}>
              {isProcessing ? 'Processing Files' : 'Uploaded Files'}
            </Heading>
            
            <Grid templateColumns={{ base: "repeat(auto-fill, minmax(150px, 1fr))", md: "repeat(auto-fill, minmax(200px, 1fr))" }} gap={{ base: 3, md: 4 }}>
              {uploadedImages && uploadedImages.map(img => {
                const status = processingStatus[img.id] || { status: 'pending' }
                const result = imageResults?.results?.find(r => r.filename === img.name)
                const failedLayer = result ? getFailedLayerInfo(result.layerResults) : null
                
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
                          <Badge colorScheme={getAuthColorScheme(result.authenticity, failedLayer?.verdict)} fontSize="xs">
                            {failedLayer?.verdict === 'Digitally Edited' ? 'Digitally Edited' : result.authenticity}
                          </Badge>
                        ) : status.status === 'error' ? (
                          <Badge colorScheme="red" fontSize="xs">Error</Badge>
                        ) : (
                          <SandClockIcon />
                        )}
                      </Flex>
                    </VStack>
                  </Box>
                )
              })}

              {uploadedVideos && uploadedVideos.map(vid => {
                const status = processingStatus[vid.id] || { status: 'pending' }
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
                          <SandClockIcon />
                        )}
                      </Flex>
                    </VStack>
                  </Box>
                )
              })}
            </Grid>
          </Box>

          {(imageResults || videoResults) && (
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
                              
                            </Text>
                          </Box>
                          <HStack spacing={4}>
                            <Box textAlign="center">
                              <Text fontSize="xs" color="gray.600">Risk</Text>
                              <Badge colorScheme={getRiskColorScheme(videoResults.riskScore)}>
                                {videoResults.riskScore}
                              </Badge>
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
                                    {item.failedAtLayer && item.details ? (
                                      <Box p={4} bg="red.50" borderRadius="md" border="1px" borderColor="red.200">
                                        <Text fontSize="sm" color="red.700" fontWeight="medium" mb={3}>
                                          AI Content Detected
                                        </Text>
                                        
                                        <VStack spacing={2} align="stretch">
                                          {item.details.verdict && (
                                            <Flex justify="space-between">
                                              <Text fontSize="xs" color="gray.600">Verdict:</Text>
                                              <Text fontSize="xs" fontWeight="semibold" color="red.700">
                                                {item.details.verdict}
                                              </Text>
                                            </Flex>
                                          )}
                                          
                                          {item.details.aiPercentage !== undefined && (
                                            <Flex justify="space-between">
                                              <Text fontSize="xs" color="gray.600">AI Probability:</Text>
                                              <Text fontSize="xs" fontWeight="semibold" color="red.700">
                                                {item.details.aiPercentage}%
                                              </Text>
                                            </Flex>
                                          )}
                                          
                                          {item.details.humanPercentage !== undefined && (
                                            <Flex justify="space-between">
                                              <Text fontSize="xs" color="gray.600">Human Probability:</Text>
                                              <Text fontSize="xs" fontWeight="semibold" color="green.700">
                                                {item.details.humanPercentage}%
                                              </Text>
                                            </Flex>
                                          )}
                                          {item.details.confidence && (
                                            <Flex justify="space-between">
                                              <Text fontSize="xs" color="gray.600">Probability Level:</Text>
                                              <Text fontSize="xs" fontWeight="semibold" color="gray.700">
                                                {item.details.confidence}
                                              </Text>
                                            </Flex>
                                          )}

                                          {generator && (
                                            <Box mt={2} pt={2} borderTop="1px" borderColor="red.200">
                                              <Text fontSize="xs" color="red.600">
                                                Appears to be made using {generator}
                                              </Text>
                                            </Box>
                                          )}
                                        </VStack>
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
                              
                            </Text>
                          </Box>
                          <HStack spacing={4}>
                            <Box textAlign="center">
                              <Text fontSize="xs" color="gray.600">Risk</Text>
                              <Badge colorScheme={getRiskColorScheme(imageResults.riskScore)}>
                                {imageResults.riskScore}
                              </Badge>
                            </Box>
                          </HStack>
                        </Flex>
                      </Box>

                      <Accordion allowMultiple>
                        {imageResults.results && imageResults.results.map((item, idx) => {
                          const formattedDetails = formatImageDetails(item.details)
                          const imagePreview = imagePreviewMap[item.filename]
                          const failedLayer = getFailedLayerInfo(item.layerResults)
                          const isDigitallyEdited = failedLayer?.verdict === 'Digitally Edited'
                          const imageGenerator = getImageGeneratorFromDetails(failedLayer)
                          
                          return (
                            <AccordionItem key={idx} border="none" borderBottom="1px" borderColor="gray.100">
                              <AccordionButton py={4} _hover={{ bg: 'gray.50' }}>
                                <Flex flex={1} align="center" gap={3}>
                                  <Icon
                                    as={item.authenticity === 'Likely Genuine' ? FiCheckCircle : FiXCircle}
                                    color={item.authenticity === 'Likely Genuine' ? 'green.500' : isDigitallyEdited ? 'yellow.500' : 'red.500'}
                                    boxSize={5}
                                  />
                                  <Box flex={1} textAlign="left">
                                    <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.900" noOfLines={1}>
                                      {item.filename}
                                    </Text>
                                    <HStack spacing={2} mt={1} flexWrap="wrap">
                                      <Badge colorScheme={getAuthColorScheme(item.authenticity, failedLayer?.verdict)} fontSize="xs">
                                        {isDigitallyEdited ? 'Digitally Edited' : item.authenticity}
                                      </Badge>
                                      {item.details?.isScreenshot && (
                                        <Badge colorScheme="purple" fontSize="xs" display="flex" alignItems="center" gap={1}>
                                          <Icon as={FiMonitor} boxSize={3} />
                                          Screenshot</Badge>
                                      )}
                                      {item.details?.isCameraPhoto && (
                                        <Badge colorScheme="blue" fontSize="xs" display="flex" alignItems="center" gap={1}>
                                          <Icon as={FiCamera} boxSize={3} />
                                          Camera
                                        </Badge>
                                      )}
                                      {imageGenerator && (
                                        <Badge colorScheme="orange" fontSize="xs">
                                          {imageGenerator}
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
                                    <VStack spacing={4} align="stretch">
                                      <Box>
                                        <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                                          Analysis Result
                                        </Text>
                                        {item.authenticity === 'AI Generated' && failedLayer ? (
                                          <Box p={4} bg={isDigitallyEdited ? "yellow.50" : "red.50"} borderRadius="md" border="1px" borderColor={isDigitallyEdited ? "yellow.200" : "red.200"}>
                                            <Text fontSize="sm" color={isDigitallyEdited ? "yellow.700" : "red.700"} fontWeight="medium" mb={3}>
                                              {isDigitallyEdited ? 'Digitally Edited Content' : 'AI Content Detected'}
                                            </Text>
                                            
                                            <VStack spacing={2} align="stretch">
                                              {failedLayer.verdict && (
                                                <Flex justify="space-between">
                                                  <Text fontSize="xs" color="gray.600">Verdict:</Text>
                                                  <Text fontSize="xs" fontWeight="semibold" color={isDigitallyEdited ? "yellow.700" : "red.700"}>
                                                    {failedLayer.verdict}
                                                  </Text>
                                                </Flex>
                                              )}
                                              
                                              {failedLayer.aiPercentage !== undefined && (
                                                <Flex justify="space-between">
                                                  <Text fontSize="xs" color="gray.600">AI Probability:</Text>
                                                  <Text fontSize="xs" fontWeight="semibold" color={isDigitallyEdited ? "yellow.700" : "red.700"}>
                                                    {failedLayer.aiPercentage}%
                                                  </Text>
                                                </Flex>
                                              )}
                                              
                                              {failedLayer.humanPercentage !== undefined && (
                                                <Flex justify="space-between">
                                                  <Text fontSize="xs" color="gray.600">Human Probability:</Text>
                                                  <Text fontSize="xs" fontWeight="semibold" color="green.700">
                                                    {failedLayer.humanPercentage}%
                                                  </Text>
                                                </Flex>
                                              )}
                                              
                                              {failedLayer.confidence && (
                                                <Flex justify="space-between">
                                                  <Text fontSize="xs" color="gray.600">Probability Level:</Text>
                                                  <Text fontSize="xs" fontWeight="semibold" color="gray.700">
                                                    {failedLayer.confidence}
                                                  </Text>
                                                </Flex>
                                              )}

                                              {imageGenerator && (
                                                <Box mt={2} pt={2} borderTop="1px" borderColor={isDigitallyEdited ? "yellow.200" : "red.200"}>
                                                  <Text fontSize="xs" color={isDigitallyEdited ? "yellow.600" : "red.600"}>
                                                    Appears to be made using {imageGenerator}
                                                  </Text>
                                                </Box>
                                              )}
                                            </VStack>

                                            {failedLayer.heatmapUrl && (
                                              <Box mt={3}>
                                                <Text fontSize="xs" fontWeight="semibold" color="gray.700" mb={2}>
                                                  AI Detection Heatmap:
                                                </Text>
                                                <Image
                                                  src={failedLayer.heatmapUrl}
                                                  alt="AI Detection Heatmap"
                                                  width="100%"
                                                  borderRadius="md"
                                                  border="1px"
                                                  borderColor="gray.300"
                                                  objectFit="contain"
                                                  maxH="300px"
                                                  fallback={
                                                    <Box 
                                                      width="100%" 
                                                      p={4} 
                                                      bg="gray.100" 
                                                      borderRadius="md" 
                                                      border="1px" 
                                                      borderColor="gray.300"
                                                      textAlign="center"
                                                    >
                                                      <Text fontSize="xs" color="gray.600">
                                                        Heatmap not available
                                                      </Text>
                                                    </Box>
                                                  }
                                                />
                                              </Box>
                                            )}

                                            {failedLayer.analysis && failedLayer.analysis.analysis && (
                                              <Box mt={3} p={3} bg="white" borderRadius="md" border="1px" borderColor="gray.200">
                                                <Text fontSize="xs" fontWeight="semibold" color="gray.700" mb={2}>
                                                  <Icon as={FiInfo} boxSize={3} mr={1} />
                                                  Detailed Analysis:
                                                </Text>
                                                <Text fontSize="xs" color="gray.600" whiteSpace="pre-wrap">
                                                  {failedLayer.analysis.analysis}
                                                </Text>
                                              </Box>
                                            )}
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
                                    </VStack>
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
                Export PDF Report
              </Button>
            )}
          </HStack>
        </VStack>
      </Container>
    </>
  )
}

export default ClaimReport
