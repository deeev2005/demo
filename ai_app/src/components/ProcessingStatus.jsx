import { Box, Container, VStack, Heading, Text, Progress, Flex, Icon } from '@chakra-ui/react'
import { FiClock } from 'react-icons/fi'

const ProcessingStatus = ({ data }) => {
  if (!data) return null

  return (
    <Flex minH="100vh" align="center" justify="center" p={6}>
      <Box bg="white" borderRadius="lg" border="1px" borderColor="gray.200" p={10} maxW="lg" w="full">
        <VStack spacing={6}>
          <Icon as={FiClock} boxSize={16} color="blue.600" />
          
          <VStack spacing={2}>
            <Heading size="lg" color="gray.900">Processing Claim</Heading>
            <Text color="gray.600" textAlign="center">
              Analyzing {data.imageCount} image{data.imageCount !== 1 ? 's' : ''}
              {data.videoCount > 0 && ` and ${data.videoCount} video${data.videoCount !== 1 ? 's' : ''}`} for authenticity
            </Text>
          </VStack>

          {/* Progress Bar */}
          <Box w="full">
            <Flex justify="space-between" fontSize="sm" color="gray.600" mb={2}>
              <Text>Progress</Text>
              <Text>{data.progress}%</Text>
            </Flex>
            <Progress value={data.progress} size="lg" colorScheme="blue" borderRadius="full" />
          </Box>

          {/* Vendor Status */}
          <Box bg="gray.50" borderRadius="lg" p={4} border="1px" borderColor="gray.200" w="full">
            <Flex align="center" justify="center" gap={2} fontSize="sm">
              <Box boxSize={2} bg="green.500" borderRadius="full" />
              <Text color="gray.700">Status: {data.vendor}</Text>
            </Flex>
          </Box>
        </VStack>
      </Box>
    </Flex>
  )
}

export default ProcessingStatus