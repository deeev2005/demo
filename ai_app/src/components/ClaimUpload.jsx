import { useState, useRef } from 'react'
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Textarea,
  Button,
  useToast,
  Flex,
  Icon,
  IconButton,
  Image,
  Badge
} from '@chakra-ui/react'
import { FiUpload, FiX, FiPlay } from 'react-icons/fi'
import VideoTrimmer from './VideoTrimmer'

const ClaimUpload = ({ onSubmit }) => {
  const [claimId, setClaimId] = useState('')
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const toast = useToast()
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    const remaining = 6 - images.length

    if (files.length > remaining) {
      toast({
        title: 'Upload limit exceeded',
        description: `Maximum 6 images allowed. You can add ${remaining} more.`,
        status: 'warning',
        duration: 3000,
      })
      return
    }

    const newImages = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      preview: URL.createObjectURL(file),
      type: 'image'
    }))

    setImages([...images, ...newImages])
  }

  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files)
    const remaining = 2 - videos.length

    if (files.length > remaining) {
      toast({
        title: 'Upload limit exceeded',
        description: `Maximum 2 videos allowed. You can add ${remaining} more.`,
        status: 'warning',
        duration: 3000,
      })
      return
    }

    const newVideos = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      originalFile: file,
      name: file.name,
      originalName: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      preview: URL.createObjectURL(file),
      originalPreview: URL.createObjectURL(file),
      type: 'video',
      isTrimmed: false,
      trimStart: 0,
      trimEnd: 0
    }))

    setVideos([...videos, ...newVideos])
  }

  const removeImage = (id) => {
    const img = images.find(i => i.id === id)
    if (img) URL.revokeObjectURL(img.preview)
    setImages(images.filter(i => i.id !== id))
  }

  const removeVideo = (id) => {
    const vid = videos.find(v => v.id === id)
    if (vid) {
      URL.revokeObjectURL(vid.preview)
      if (vid.originalPreview && vid.originalPreview !== vid.preview) {
        URL.revokeObjectURL(vid.originalPreview)
      }
    }
    setVideos(videos.filter(v => v.id !== id))
  }

  const trimVideoFile = async (videoFile, startTime, endTime, originalPreviewUrl) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      video.onloadedmetadata = async () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          
          // Create MediaRecorder to record the trimmed portion
          const stream = canvas.captureStream(30)
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 2500000
          })
          
          const chunks = []
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data)
            }
          }
          
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' })
            const trimmedFile = new File([blob], videoFile.name, { type: 'video/webm' })
            const trimmedPreview = URL.createObjectURL(blob)
            
            resolve({
              file: trimmedFile,
              preview: trimmedPreview,
              size: (blob.size / (1024 * 1024)).toFixed(2) + ' MB'
            })
          }
          
          mediaRecorder.onerror = (e) => {
            reject(new Error('Recording failed: ' + e.error))
          }
          
          // Start recording
          mediaRecorder.start()
          video.currentTime = startTime
          
          const drawFrame = () => {
            if (video.currentTime >= endTime) {
              mediaRecorder.stop()
              video.pause()
              return
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            requestAnimationFrame(drawFrame)
          }
          
          video.onplay = () => {
            drawFrame()
          }
          
          video.play()
          
        } catch (error) {
          reject(error)
        }
      }
      
      video.onerror = () => {
        reject(new Error('Failed to load video'))
      }
      
      video.src = originalPreviewUrl
    })
  }

  const handleVideoTrim = async (videoId, trimData) => {
    const videoToTrim = videos.find(v => v.id === videoId)
    if (!videoToTrim) return
    
    toast({
      title: 'Trimming video...',
      description: 'Please wait while we process your video',
      status: 'info',
      duration: 2000,
    })
    
    try {
      // Trim the actual video file
      const trimmedData = await trimVideoFile(
        videoToTrim.originalFile,
        trimData.trimStart,
        trimData.trimEnd,
        videoToTrim.originalPreview
      )
      
      const updatedVideos = videos.map(v => {
        if (v.id === videoId) {
          // Clean up old preview if it was already trimmed
          if (v.isTrimmed && v.preview !== v.originalPreview) {
            URL.revokeObjectURL(v.preview)
          }
          
          return {
            ...v,
            file: trimmedData.file,
            name: v.originalName,
            size: trimmedData.size,
            preview: trimmedData.preview,
            isTrimmed: true,
            trimStart: trimData.trimStart,
            trimEnd: trimData.trimEnd
          }
        }
        return v
      })
      
      setVideos(updatedVideos)
      
    } catch (error) {
      console.error('Trimming error:', error)
      toast({
        title: 'Trimming failed',
        description: error.message || 'Failed to trim video. Please try again.',
        status: 'error',
        duration: 5000,
      })
    }
  }

  const handleSubmit = () => {
    if (!claimId.trim()) {
      toast({
        title: 'Claim ID required',
        description: 'Please enter a Claim ID',
        status: 'error',
        duration: 3000,
      })
      return
    }

    if (images.length === 0 && videos.length === 0) {
      toast({
        title: 'Files required',
        description: 'Please upload at least one image or video',
        status: 'error',
        duration: 3000,
      })
      return
    }

    const combinedResults = {
      claimId,
      notes,
      uploadedImages: images,
      uploadedVideos: videos,
      processedAt: new Date().toISOString(),
      totalFiles: images.length + videos.length,
      imageCount: images.length,
      videoCount: videos.length,
      isProcessing: true
    }

    onSubmit(combinedResults)
  }

  return (
    <>
      {/* Header */}
      <Box bg="white" borderBottom="1px" borderColor="gray.200">
        <Container maxW="container.xl" py={{ base: 3, md: 4 }} px={{ base: 4, md: 6 }}>
          <Flex 
            direction={{ base: "column", md: "row" }}
            justify="space-between" 
            align={{ base: "start", md: "center" }}
            gap={{ base: 2, md: 0 }}
          >
            <Box>
              <Heading size={{ base: "md", md: "lg" }} color="gray.900">
                Claim Verification System
              </Heading>
              <Text color="gray.600" fontSize={{ base: "xs", md: "sm" }} mt={1}>
                Automated image & video authenticity analysis
              </Text>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={{ base: 4, md: 8 }} px={{ base: 4, md: 6 }}>
        <Box bg="white" borderRadius="lg" border="1px" borderColor="gray.200" p={{ base: 4, md: 8 }}>
          <VStack spacing={{ base: 6, md: 8 }} align="stretch">
            {/* Claim ID */}
            <Box>
              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.700" mb={2}>
                Claim ID <Text as="span" color="red.600">*</Text>
              </Text>
              <Input
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                placeholder="e.g., CLM-2026-12345"
                size={{ base: "md", md: "lg" }}
              />
            </Box>

            {/* Image Upload */}
            <Box>
              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.700" mb={2}>
                Claim Images{' '}
                <Text as="span" color="gray.500" fontWeight="normal">
                  ({images.length}/6)
                </Text>
              </Text>

              {images.length < 6 && (
                <Box
                  border="2px dashed"
                  borderColor="gray.300"
                  borderRadius="lg"
                  p={{ base: 6, md: 8 }}
                  textAlign="center"
                  cursor="pointer"
                  _hover={{ borderColor: 'gray.400', bg: 'gray.50' }}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Icon as={FiUpload} boxSize={{ base: 8, md: 10 }} color="gray.400" mb={3} />
                  <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600" mb={1}>
                    Click to upload images
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    PNG, JPG up to 10MB each (max 6 images)
                  </Text>
                  <Input
                    ref={imageInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    display="none"
                  />
                </Box>
              )}

              {images.length > 0 && (
                <VStack spacing={2} mt={4}>
                  {images.map(img => (
                    <Flex
                      key={img.id}
                      p={{ base: 2, md: 3 }}
                      bg="gray.50"
                      borderRadius="md"
                      border="1px"
                      borderColor="gray.200"
                      w="full"
                      justify="space-between"
                      align="center"
                    >
                      <HStack spacing={{ base: 2, md: 3 }}>
                        <Image 
                          src={img.preview} 
                          boxSize={{ base: "40px", md: "48px" }} 
                          objectFit="cover" 
                          borderRadius="md" 
                        />
                        <Box>
                          <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.900" noOfLines={1}>
                            {img.name}
                          </Text>
                          <Text fontSize="xs" color="gray.500">{img.size}</Text>
                        </Box>
                      </HStack>
                      <IconButton
                        icon={<FiX />}
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => removeImage(img.id)}
                      />
                    </Flex>
                  ))}
                </VStack>
              )}
            </Box>

            {/* Video Upload */}
            <Box>
              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.700" mb={2}>
                Claim Videos{' '}
                <Text as="span" color="gray.500" fontWeight="normal">
                  (Optional) ({videos.length}/2)
                </Text>
              </Text>

              {videos.length < 2 && (
                <Box
                  border="2px dashed"
                  borderColor="gray.300"
                  borderRadius="lg"
                  p={{ base: 6, md: 8 }}
                  textAlign="center"
                  cursor="pointer"
                  _hover={{ borderColor: 'gray.400', bg: 'gray.50' }}
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Icon as={FiUpload} boxSize={{ base: 8, md: 10 }} color="gray.400" mb={3} />
                  <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600" mb={1}>
                    Click to upload videos
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    MP4, MOV up to 50MB each (max 2 videos)
                  </Text>
                  <Input
                    ref={videoInputRef}
                    type="file"
                    multiple
                    accept="video/*"
                    onChange={handleVideoUpload}
                    display="none"
                  />
                </Box>
              )}

              {videos.length > 0 && (
                <VStack spacing={2} mt={4}>
                  {videos.map(vid => (
                    <Flex
                      key={vid.id}
                      p={{ base: 2, md: 3 }}
                      bg="gray.50"
                      borderRadius="md"
                      border="1px"
                      borderColor="gray.200"
                      w="full"
                      justify="space-between"
                      align="center"
                    >
                      <HStack
                        spacing={{ base: 2, md: 3 }}
                        flex={1}
                        cursor="pointer"
                        onClick={() => setSelectedVideo(vid)}
                        _hover={{ bg: 'gray.100' }}
                        p={{ base: 2, md: 3 }}
                        m={{ base: -2, md: -3 }}
                        borderRadius="md"
                      >
                        <Flex
                          boxSize={{ base: "40px", md: "48px" }}
                          bg="gray.200"
                          borderRadius="md"
                          align="center"
                          justify="center"
                        >
                          <Icon as={FiPlay} boxSize={{ base: 5, md: 6 }} color="gray.600" />
                        </Flex>
                        <Box flex={1}>
                          <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.900" noOfLines={1}>
                            {vid.name}
                          </Text>
                          <HStack spacing={2} flexWrap="wrap">
                            <Text fontSize="xs" color="gray.500">{vid.size}</Text>
                            {vid.isTrimmed && (
                              <Badge colorScheme="blue" fontSize="xs">
                                Trimmed ({vid.trimStart.toFixed(1)}s - {vid.trimEnd.toFixed(1)}s)
                              </Badge>
                            )}
                          </HStack>
                        </Box>
                      </HStack>
                      <IconButton
                        icon={<FiX />}
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => removeVideo(vid.id)}
                      />
                    </Flex>
                  ))}
                </VStack>
              )}
            </Box>

            {/* Notes */}
            <Box>
              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="gray.700" mb={2}>
                Additional Notes{' '}
                <Text as="span" color="gray.500" fontWeight="normal">
                  (Optional)
                </Text>
              </Text>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any relevant context or observations..."
                rows={3}
                resize="none"
                size={{ base: "sm", md: "md" }}
              />
            </Box>

            {/* Submit Button */}
            <Button
              colorScheme="blue"
              size={{ base: "md", md: "lg" }}
              onClick={handleSubmit}
              isDisabled={!claimId.trim() || (images.length === 0 && videos.length === 0)}
              w={{ base: "full", md: "auto" }}
            >
              Analyze Claim
            </Button>
          </VStack>
        </Box>
      </Container>

      {/* Video Trimmer Modal */}
      {selectedVideo && (
        <VideoTrimmer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onApply={(trimData) => {
            handleVideoTrim(selectedVideo.id, trimData)
            setSelectedVideo(null)
          }}
        />
      )}
    </>
  )
}

export default ClaimUpload