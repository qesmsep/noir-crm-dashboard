import { Box, Button, Container, Heading, Text, VStack, Collapse, useDisclosure } from '@chakra-ui/react';
import ReservationForm from './ReservationForm';
import '../styles/fonts.css';

const ReservationSection = ({ baseDays, bookingStartDate, bookingEndDate }) => {
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
      py={100} 
      bg="#A59480"
      display="flex"
      alignItems="center"
    >
      <Container maxW="container.xl">
        <Box textAlign="center" mb={12}>
          <Heading 
            as="h2" 
            size="xl" 
            mb={6}
            color="#353535"
            fontFamily="IvyJournalThin, Montserrat, sans-serif"
            fontWeight="bold"
            letterSpacing="0.05em"
          >
            Reserve a Table
          </Heading>
          <Text 
            fontSize="xl" 
            color="white" 
            maxW="2xl" 
            mx="auto"
            opacity={0.9}
            fontFamily="Montserrat, sans-serif"
          >
            Experience the perfect blend of luxury and comfort at our exclusive lounge.
            Choose your reservation type below.
          </Text>
        </Box>

        <VStack spacing={8} align="stretch" maxW="400px" mx="auto">
          <VStack spacing={4} w="full">
            <Collapse in={!isNonMemberOpen} animateOpacity>
              <Button
                size="lg"
                bg="#353535"
                color="#a59480"
                _hover={{ bg: '#222', color: 'white' }}
                onClick={handleMemberClick}
                w="full"
                py={8}
                fontSize="lg"
                fontWeight="bold"
                fontFamily="Montserrat, sans-serif"
                letterSpacing="0.05em"
                boxShadow="2xl"
                transition="all 0.2s"
                _active={{
                  transform: 'scale(0.98)',
                  boxShadow: 'lg'
                }}
              >
                Noir Members
              </Button>
            </Collapse>
            <Collapse in={!isMemberOpen} animateOpacity>
              <Button
                size="lg"
                variant="outline"
                borderColor="#353535"
                color="#353535"
                _hover={{ bg: '#cac2b9', color: '#353535', borderColor: '#353535' }}
                onClick={handleNonMemberClick}
                w="full"
                py={8}
                fontSize="lg"
                fontWeight="bold"
                fontFamily="Montserrat, sans-serif"
                letterSpacing="0.05em"
                boxShadow="2xl"
                transition="all 0.2s"
                _active={{
                  transform: 'scale(0.98)',
                  boxShadow: 'lg'
                }}
              >
                Non-Members
              </Button>
            </Collapse>
          </VStack>

          {/* Member Reservation Form */}
          <Collapse in={isMemberOpen} animateOpacity>
            <ReservationForm isMember={true} onClose={onMemberClose} baseDays={baseDays} bookingStartDate={bookingStartDate} bookingEndDate={bookingEndDate} />
          </Collapse>

          {/* Non-Member Reservation Form */}
          <Collapse in={isNonMemberOpen} animateOpacity>
            <ReservationForm isMember={false} onClose={onNonMemberClose} baseDays={baseDays} bookingStartDate={bookingStartDate} bookingEndDate={bookingEndDate} />
          </Collapse>
        </VStack>
      </Container>
    </Box>
  );
};

export default ReservationSection; 