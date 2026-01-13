import { useState, useRef, useEffect } from 'react'
import {
  VStack,
  HStack,
  Stack,
  Text,
  Button,
  Box,
  Icon,
  Flex,
  IconButton,
  RangeSlider,
  RangeSliderTrack,
  RangeSliderFilledTrack,
  RangeSliderThumb,
} from '@chakra-ui/react'
import { FiScissors, FiX, FiPlay, FiPause, FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const VideoTrimmer = ({ video, onClose, onApply }) => {
  const [trimRange, setTrimRange] = useState([0, 0])
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        const dur = videoRef.current.duration
        setDuration(dur)
        setTrimRange([0, dur])
      }

      videoRef.current.ontimeupdate = () => {
        const time = videoRef.current.currentTime
        setCurrentTime(time)
        
        // Loop playback within the trim range
        if (time >= trimRange[1]) {
          videoRef.current.currentTime = trimRange[0]
        }
      }
    }
  }, [trimRange])

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleApply = () => {
    const [start, end] = trimRange
    const isTrimmed = start > 0 || end < duration
    onApply({
      trimStart: start,
      trimEnd: end,
      isTrimmed,
      duration: end - start
    })
  }

  const handleRangeChange = (values) => {
    setTrimRange(values)
    // Real-time preview: seek to the edge being moved
    if (videoRef.current) {
      if (values[0] !== trimRange[0]) {
        videoRef.current.currentTime = values[0]
      } else if (values[1] !== trimRange[1]) {
        videoRef.current.currentTime = values[1]
      }
    }
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        if (videoRef.current.currentTime >= trimRange[1] || videoRef.current.currentTime < trimRange[0]) {
          videoRef.current.currentTime = trimRange[0]
        }
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <Box
      position="fixed"
      top={0} left={0} right={0} bottom={0}
      bg="blackAlpha.800"
      display="flex"
      alignItems="center"
      justifyContent="center"
      zIndex={1000}
      p={[2, 4, 6]} // Responsive padding
      onClick={onClose}
    >
      <Box
        bg="white"
        borderRadius={{ base: "none", md: "xl" }} // Full screen feel on mobile
        maxW="4xl"
        w="full"
        maxH="100vh"
        onClick={(e) => e.stopPropagation()}
        boxShadow="2xl"
        overflowY="auto"
      >
        {/* Header */}
        <Flex 
          justify="space-between" 
          align="center" 
          p={[3, 4]} 
          borderBottom="1px" 
          borderColor="gray.100"
        >
          <HStack spacing={2}>
            <Icon as={FiScissors} color="blue.500" boxSize={[4, 5]} />
            <Text fontWeight="bold" fontSize={["md", "lg"]}>Trim Video</Text>
          </HStack>
          <IconButton 
            icon={<FiX />} 
            variant="ghost" 
            onClick={onClose} 
            size="sm" 
            aria-label="Close"
          />
        </Flex>

        <Box p={[4, 6, 8]}>
          <VStack spacing={[6, 8]}>
            {/* Responsive Video Container */}
            <Box 
              w="full" 
              position="relative" 
              bg="black" 
              borderRadius="lg" 
              overflow="hidden"
              boxShadow="inner"
              // Adjusts height based on aspect ratio but keeps it within view
              maxH={["300px", "450px", "600px"]}
            >
              <video
                ref={videoRef}
                src={video.preview}
                style={{ width: '100%', maxHeight: 'inherit', display: 'block', margin: '0 auto' }}
              />
              <Flex
                position="absolute"
                top={0} left={0} right={0} bottom={0}
                align="center" justify="center"
                onClick={handlePlayPause}
                cursor="pointer"
                bg={isPlaying ? "transparent" : "blackAlpha.400"}
                transition="all 0.2s"
              >
                {!isPlaying && (
                  <IconButton
                    icon={<FiPlay />}
                    isRound
                    size="lg"
                    colorScheme="blue"
                    fontSize="2xl"
                    boxShadow="xl"
                    pointerEvents="none"
                  />
                )}
              </Flex>
            </Box>

            {/* Android Style Timeline */}
            <Box w="full" px={[0, 2]}>
              <VStack spacing={4} align="stretch">
                <Flex justify="space-between" w="full" px={1}>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="2xs" color="gray.500" fontWeight="bold">START</Text>
                    <Text fontSize="sm" fontWeight="bold" color="blue.600">{formatTime(trimRange[0])}</Text>
                  </VStack>
                  <VStack align="center" spacing={0}>
                    <Text fontSize="2xs" color="gray.500" fontWeight="bold">DURATION</Text>
                    <Text fontSize="sm" fontWeight="bold">{formatTime(trimRange[1] - trimRange[0])}</Text>
                  </VStack>
                  <VStack align="end" spacing={0}>
                    <Text fontSize="2xs" color="gray.500" fontWeight="bold">END</Text>
                    <Text fontSize="sm" fontWeight="bold" color="blue.600">{formatTime(trimRange[1])}</Text>
                  </VStack>
                </Flex>

                <Box position="relative" w="full" h="60px" display="flex" alignItems="center">
                  <RangeSlider
                    aria-label={['start', 'end']}
                    min={0}
                    max={duration}
                    step={0.1}
                    value={trimRange}
                    onChange={handleRangeChange}
                    focusThumbOnChange={false}
                  >
                    <RangeSliderTrack bg="gray.100" h="48px" borderRadius="md">
                      <RangeSliderFilledTrack 
                        bg="blue.50" 
                        borderLeft="4px solid" 
                        borderRight="4px solid" 
                        borderColor="blue.500" 
                      />
                    </RangeSliderTrack>
                    
                    {/* Left Bar Thumb */}
                    <RangeSliderThumb 
                      index={0} 
                      h="60px" 
                      w="24px" 
                      bg="blue.500" 
                      borderRadius="md"
                      boxShadow="lg"
                      _active={{ transform: "scale(1.1)" }}
                    >
                        <Icon as={FiChevronLeft} color="white" />
                    </RangeSliderThumb>

                    {/* Right Bar Thumb */}
                    <RangeSliderThumb 
                      index={1} 
                      h="60px" 
                      w="24px" 
                      bg="blue.500" 
                      borderRadius="md"
                      boxShadow="lg"
                      _active={{ transform: "scale(1.1)" }}
                    >
                        <Icon as={FiChevronRight} color="white" />
                    </RangeSliderThumb>
                  </RangeSlider>
                </Box>
              </VStack>
            </Box>

            {/* Bottom Actions - Responsive Stack */}
            <Stack 
              direction={{ base: "column-reverse", sm: "row" }} 
              w="full" 
              spacing={3} 
              pt={2}
            >
              <Button 
                variant="ghost" 
                flex={1} 
                onClick={onClose}
                size={["md", "lg"]}
              >
                Cancel
              </Button>
              <Button 
                colorScheme="blue" 
                flex={2} 
                size={["md", "lg"]} 
                onClick={handleApply}
                leftIcon={<FiScissors />}
              >
                Apply Selection
              </Button>
            </Stack>
          </VStack>
        </Box>
      </Box>
    </Box>
  )
}

export default VideoTrimmer