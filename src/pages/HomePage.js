import React, { useState, useEffect } from "react";
import { Box, Button, Flex, Heading, Text, VStack, HStack, Input, Select, Image, Link as ChakraLink } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import ReserveOnSpotModal from "../components/ReserveOnSpotModal";
import heroBg from '../assets/images/LPR67899.JPG';
import cocktailsImg from '../assets/images/LPR66872.JPG';
import logoImg from '../assets/images/noir-wedding-day.png';
import cloud33 from '../assets/images/Cloud-NoBkgd-33.png';
import cloud34 from '../assets/images/Cloud-NoBkgd-34.png';
import ReservationForm from '../components/ReservationForm';

import { supabase } from "../api/supabaseClient";

export default function HomePage() {
  const [reserveOpen, setReserveOpen] = React.useState(false);
  const [bookingStartDate, setBookingStartDate] = useState(null);
  const [bookingEndDate, setBookingEndDate] = useState(null);

  useEffect(() => {
    async function fetchBookingWindow() {
      const { data: startData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "booking_start_date")
        .single();
      const { data: endData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "booking_end_date")
        .single();
      setBookingStartDate(startData?.value ? new Date(startData.value) : null);
      setBookingEndDate(endData?.value ? new Date(endData.value) : null);
    }
    fetchBookingWindow();
  }, []);

  return (
    <Box minH="100vh" bg="weddingDay">
      {/* Hero Section */}
      <Box position="relative" minH="100vh" bgImage={`url(${heroBg})`} bgSize="cover" bgPosition="center" color="white">
        <Box
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          bg="cork"
          opacity={0.20}
          zIndex={0}
        />
        <Flex direction="column" align="center" justify="center" minH="80vh" textAlign="center" zIndex={1}>
          <Heading
            as="h1"
            textTransform="uppercase"
            textShadow="0px 2px 4px rgba(0, 0, 0, 0.2)"
            fontSize={{ base: "3xl", md: "6xl" }}
            fontWeight=""
            mb={4}
            lineHeight="1.1"
            fontFamily="'IvyJournal-Thin', sans-serif"
          >
            Elevated Spirits.<br />Unforgettable space.
          </Heading>
          <Text fontFamily="'Montserrat-Light', sans-serif" fontSize={{ base: "md", md: "xl" }} maxW="2xl" mb={8}>
            Tucked in downtown Kansas City, Noir is a cocktail lounge designed for those who appreciate the art of ambiance. From signature drinks to intimate interiors, every detail is crafted to elevate your evening. Sip, indulge and escape the ordinary.
          </Text>
          <Button as={Link} to="/menu" bg="cork" color="nightSky" borderRadius="2xl" px={10} py={6} fontWeight="bold" fontSize="xl" _hover={{ bg: 'daybreak' }}>Menu</Button>
        </Flex>
      </Box>

      {/* Reserve a Table Section */}
      <Box bg="cork" py={24} textAlign="center">
        <Heading as="h2" fontSize={{ base: "3xl", md: "6xl" }} fontWeight="bold" mb={4}>Reserve a table</Heading>
        <Text fontSize={{ base: "md", md: "xl" }} mb={10}>
          Your table is waiting—discover cocktails worth lingering over in a space you won't want to leave.
        </Text>
        <Box display="flex" justifyContent="center">
          <ReservationForm
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
          />
        </Box>
      </Box>

      {/* Menu Section */}
      <Box bg="daybreak" py={24} textAlign="center">
        <Heading as="h2" fontSize={{ base: "3xl", md: "6xl" }} fontWeight="bold" mb={4}>
          Menu
        </Heading>
        <Text fontSize={{ base: "md", md: "xl" }} mb={10}>
          Discover our signature cocktails and curated bites.
        </Text>
        <Button
          as={Link}
          to="/menu"
          bg="nightSky"
          color="white"
          borderRadius="2xl"
          px={8}
          py={6}
          fontWeight="bold"
          fontSize="lg"
          _hover={{ bg: 'greige' }}
        >
          View Menu
        </Button>
      </Box>

      {/* Hours & Location Section */}
      <Flex bg="weddingDay" py={24} px={{ base: 4, md: 24 }} align="center" justify="center" direction={{ base: "column", md: "row" }}>
        <Image src={cocktailsImg} alt="Cocktails" borderRadius="2xl" boxSize={{ base: "320px", md: "420px" }} objectFit="cover" mr={{ md: 16 }} mb={{ base: 8, md: 0 }} />
        <VStack align="start" spacing={6} maxW="lg">
          <Heading as="h3" fontSize={{ base: "3xl", md: "5xl" }} fontWeight="bold">Hours & Location</Heading>
          <Text fontSize="xl" fontWeight="medium" textDecor="underline">106 W. 11th St. Kansas City, Mo 68104</Text>
          <Text fontSize="lg">Thursday - 6pm-12am<br />Friday - 6pm-1am<br />Saturday - 6pm-1am</Text>
          <Button as={Link} to="/reserve" bg="nightSky" color="white" borderRadius="2xl" px={8} py={4} fontWeight="bold" fontSize="lg" _hover={{ bg: 'greige' }}>Book now</Button>
        </VStack>
      </Flex>

      {/* Social Section */}
      <Flex bg="greige" py={24} px={{ base: 4, md: 24 }} align="center" justify="center" direction={{ base: "column", md: "row" }}>
        <VStack align="start" spacing={6} maxW="lg">
          <Heading as="h3" fontSize={{ base: "3xl", md: "5xl" }} fontWeight="bold">Follow us on social</Heading>
        </VStack>
        <Image src={cocktailsImg} alt="Social Cocktails" borderRadius="2xl" boxSize={{ base: "320px", md: "420px" }} objectFit="cover" ml={{ md: 16 }} mt={{ base: 8, md: 0 }} />
      </Flex>

      {/* Footer */}
      <Flex bg="nightSky" color="weddingDay" py={8} px={{ base: 4, md: 24 }} align="center" justify="space-between">
        <Image src={logoImg} alt="Noir" height="60px" objectFit="contain" />
        <HStack spacing={12} fontSize="lg">
          <VStack align="start" spacing={0}>
            <Text fontWeight="bold">Location</Text>
            <Text>106 W. 11th St,<br />Kansas City, MO 64105</Text>
          </VStack>
          <VStack align="start" spacing={0}>
            <Text fontWeight="bold">Contact</Text>
            <Text>drink@noirkc.com<br />913.777.4488</Text>
          </VStack>
        </HStack>
      </Flex>
    </Box>
  );
}