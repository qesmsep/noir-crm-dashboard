import { Box, Button, Container, Heading, Text, VStack, Collapse, useDisclosure } from '@chakra-ui/react';
import ReservationForm from './ReservationForm';
import '../styles/fonts.css';

interface ReservationSectionProps {
  baseDays: any;
  bookingStartDate: any;
  bookingEndDate: any;
}

const ReservationSection = ({ baseDays, bookingStartDate, bookingEndDate }: ReservationSectionProps) => {
  const { isOpen: isMemberOpen, onOpen: onMemberOpen, onClose: onMemberClose } = useDisclosure();
  const { isOpen: isNonMemberOpen, onOpen: onNonMemberOpen, onClose: onNonMemberClose } = useDisclosure();

  const handleMemberClick = () => {
    if (isMemberOpen) {
      onMemberClose();
    } else {
      onNonMemberClose();
      onMemberOpen();
    }
  };

  const handleNonMemberClick = () => {
    if (isNonMemberOpen) {
      onNonMemberClose();
    } else {
      onMemberClose();
      onNonMemberOpen();
    }
  };

  return (
    <Box 
      as="section" 
      py={{ base: 12, sm: 16, md: 20, lg: 24 }}
      px={{ base: 4, sm: 6, md: 8 }}
      bg="#A59480"
      display="flex"
      alignItems="center"
      minH={{ base: 'auto', md: '100vh' }}
    >
      <Container maxW="container.xl" px={{ base: 0, sm: 4 }}>
        <Box textAlign="center" mb={{ base: 6, sm: 8, md: 10 }}>
          <Heading 
            as="h2" 
            size={{ base: "lg", sm: "xl", md: "2xl" }}
            mb={{ base: 3, sm: 4, md: 6 }}
            color="#353535"
            fontFamily="IvyJournalThin, Montserrat, sans-serif"
            fontWeight="bold"
            letterSpacing="0.05em"
            lineHeight="1.2"
          >
            Reserve a Table
          </Heading>
          <Text 
            fontSize={{ base: "md", sm: "lg", md: "xl" }}
            color="white" 
            maxW={{ base: "full", sm: "2xl" }}
            mx="auto"
            opacity={0.9}
            fontFamily="Montserrat, sans-serif"
            lineHeight="1.5"
            px={{ base: 4, sm: 0 }}
          >
            Experience the perfect blend of luxury and comfort at our exclusive lounge.
            Choose your reservation type below.
          </Text>
        </Box>

        <VStack spacing={{ base: 4, sm: 6 }} align="stretch" maxW={{ base: "full", sm: "400px" }} mx="auto">
          <VStack spacing={{ base: 3, sm: 4 }} w="full">
            <Collapse in={!isNonMemberOpen} animateOpacity>
              <Button
                size={{ base: "md", sm: "lg" }}
                bg="#353535"
                color="#a59480"
                _hover={{ bg: '#222', color: 'white' }}
                onClick={handleMemberClick}
                w="full"
                py={{ base: 5, sm: 6, md: 8 }}
                px={{ base: 4, sm: 6 }}
                fontSize={{ base: "md", sm: "lg" }}
                fontWeight="bold"
                fontFamily="Montserrat, sans-serif"
                letterSpacing="0.05em"
                boxShadow="2xl"
                transition="all 0.2s"
                _active={{
                  transform: 'scale(0.98)',
                  boxShadow: 'lg'
                }}
                minH={{ base: "52px", sm: "56px", md: "64px" }}
                borderRadius="xl"
              >
                Noir Members
              </Button>
            </Collapse>
            <Collapse in={!isMemberOpen} animateOpacity>
              <Button
                size={{ base: "md", sm: "lg" }}
                variant="outline"
                borderColor="#353535"
                color="#353535"
                _hover={{ bg: '#cac2b9', color: '#353535', borderColor: '#353535' }}
                onClick={handleNonMemberClick}
                w="full"
                py={{ base: 5, sm: 6, md: 8 }}
                px={{ base: 4, sm: 6 }}
                fontSize={{ base: "md", sm: "lg" }}
                fontWeight="bold"
                fontFamily="Montserrat, sans-serif"
                letterSpacing="0.05em"
                boxShadow="2xl"
                transition="all 0.2s"
                _active={{
                  transform: 'scale(0.98)',
                  boxShadow: 'lg'
                }}
                minH={{ base: "52px", sm: "56px", md: "64px" }}
                borderRadius="xl"
              >
                Non-Members
              </Button>
            </Collapse>
          </VStack>

          {/* Member Reservation Form */}
          <Collapse in={isMemberOpen} animateOpacity>
            <Box 
              bg="white" 
              p={{ base: 4, sm: 6, md: 8 }} 
              borderRadius="2xl" 
              boxShadow="2xl"
              mx={{ base: 2, sm: 0 }}
              my={{ base: 2, sm: 0 }}
            >
              <ReservationForm 
                isMember={true} 
                onClose={onMemberClose} 
                baseDays={baseDays} 
                bookingStartDate={bookingStartDate} 
                bookingEndDate={bookingEndDate} 
              />
            </Box>
          </Collapse>

          {/* Non-Member Reservation Form */}
          <Collapse in={isNonMemberOpen} animateOpacity>
            <Box 
              bg="white" 
              p={{ base: 4, sm: 6, md: 8 }} 
              borderRadius="2xl" 
              boxShadow="2xl"
              mx={{ base: 2, sm: 0 }}
              my={{ base: 2, sm: 0 }}
            >
              <ReservationForm 
                isMember={false} 
                onClose={onNonMemberClose} 
                baseDays={baseDays} 
                bookingStartDate={bookingStartDate} 
                bookingEndDate={bookingEndDate} 
              />
            </Box>
          </Collapse>
        </VStack>
      </Container>
    </Box>
  );
};

export default ReservationSection; 