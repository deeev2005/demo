import React, { useState } from 'react';
import { 
  Box, 
  Container, 
  VStack, 
  Heading, 
  Text, 
  Input, 
  Button, 
  FormControl, 
  FormLabel, 
  InputGroup, 
  InputRightElement, 
  IconButton,
  Alert,
  AlertIcon,
  AlertDescription,
  Flex,
  useToast
} from '@chakra-ui/react';
import { FiEye, FiEyeOff, FiShield } from 'react-icons/fi';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Call your backend login API
      const response = await fetch(`${import.meta.env.VITE_IMAGE_API_URL || 'http://localhost:5000'}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Save token and company info
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('company', data.company);
        
        toast({
          title: 'Login successful',
          description: `Welcome, ${data.company}!`,
          status: 'success',
          duration: 2000,
        });

        // Redirect to main app
        setTimeout(() => {
          onLogin();
        }, 500);
      } else {
        setError(data.error || 'Invalid email or password');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box bg="white" borderBottom="1px" borderColor="gray.200" py={4}>
        <Container maxW="container.xl">
          <Flex align="center" gap={2}>
            <Box 
              bg="blue.500" 
              p={2} 
              borderRadius="md"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <FiShield color="white" size={24} />
            </Box>
            <Box>
              <Heading size="md" color="gray.900">
                Claim Verification System
              </Heading>
              <Text fontSize="xs" color="gray.600">
                AI-Powered Authenticity Analysis
              </Text>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* Login Form */}
      <Container maxW="md" py={{ base: 8, md: 16 }}>
        <VStack spacing={6}>
          {/* Welcome Card */}
          <Box
            w="full"
            bg="white"
            borderRadius="xl"
            boxShadow="lg"
            p={{ base: 6, md: 8 }}
            border="1px"
            borderColor="gray.200"
          >
            <VStack spacing={6} align="stretch">
              {/* Title */}
              <Box textAlign="center">
                <Heading size="lg" color="gray.900" mb={2}>
                  Welcome Back
                </Heading>
                <Text color="gray.600" fontSize="sm">
                  Sign in to access your claim verification dashboard
                </Text>
              </Box>

              {/* Error Alert */}
              {error && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Demo Credentials Info */}
              <Box 
                bg="blue.50" 
                p={4} 
                borderRadius="md" 
                border="1px" 
                borderColor="blue.200"
              >
                <Text fontSize="xs" fontWeight="semibold" color="blue.900" mb={2}>
                  Demo Credentials:
                </Text>
                <VStack align="stretch" spacing={1}>
                  <Text fontSize="xs" color="blue.700">
                    Email: <Text as="span" fontFamily="mono">demo@company.com</Text>
                  </Text>
                  <Text fontSize="xs" color="blue.700">
                    Password: <Text as="span" fontFamily="mono">Demo123!</Text>
                  </Text>
                </VStack>
              </Box>

              {/* Login Form */}
              <VStack spacing={4}>
                {/* Email Input */}
                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium" color="gray.700">
                    Email Address
                  </FormLabel>
                  <Input
                    type="email"
                    placeholder="demo@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    size="lg"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{ borderColor: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182ce' }}
                  />
                </FormControl>

                {/* Password Input */}
                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium" color="gray.700">
                    Password
                  </FormLabel>
                  <InputGroup size="lg">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      bg="white"
                      borderColor="gray.300"
                      _hover={{ borderColor: 'gray.400' }}
                      _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182ce' }}
                    />
                    <InputRightElement>
                      <IconButton
                        icon={showPassword ? <FiEyeOff /> : <FiEye />}
                        onClick={() => setShowPassword(!showPassword)}
                        variant="ghost"
                        size="sm"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  colorScheme="blue"
                  size="lg"
                  w="full"
                  isLoading={isLoading}
                  loadingText="Signing in..."
                  isDisabled={!email || !password}
                  mt={2}
                >
                  Sign In
                </Button>
              </VStack>
            </VStack>
          </Box>

          {/* Footer Info */}
          <Box textAlign="center">
            <Text fontSize="xs" color="gray.500">
              Secure access for authorized insurance companies
            </Text>
            <Text fontSize="xs" color="gray.400" mt={1}>
              © 2026 Claim Verification System. All rights reserved.
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};

export default LoginPage;