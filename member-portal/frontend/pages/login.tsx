import { useState } from 'react';
import { Box, Button, Input, Heading, VStack } from '@chakra-ui/react';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // TODO: connect to backend auth endpoint
    alert(`Logging in with ${phone}`);
  };

  return (
    <Box maxW="sm" mx="auto" mt="20">
      <VStack spacing={4}>
        <Heading size="md">Member Portal Login</Heading>
        <Input
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button onClick={handleLogin} width="full" colorScheme="teal">
          Login
        </Button>
      </VStack>
    </Box>
  );
}