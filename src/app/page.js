'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { Box, VStack, Text, Button, Input, Select, HStack, IconButton, Center, useToast, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, DrawerCloseButton, FormControl, FormLabel, Heading } from '@chakra-ui/react';
import { useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton } from '@chakra-ui/react';
import { AddIcon, MinusIcon, ChevronDownIcon } from '@chakra-ui/icons';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import { supabase } from '../pages/api/supabaseClient';
import ReservationForm from '@/components/ReservationForm';
import ReservationSection from '@/components/ReservationSection';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;
  
function InlineStripeForm({ partySize, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const handleCardSubmit = async (e) => {
    e.preventDefault && e.preventDefault();
    if (!stripe || !elements) return;
    // Get individual elements
    const cardNumber = elements.getElement(CardNumberElement);
    // Use CardNumberElement for payment method
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumber,
    });
    if (error) {
      toast({ title: error.message, status: 'error', duration: 3000 });
      return;
    }
    // Call your API to create a hold
    const resp = await fetch('/api/create-hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method_id: paymentMethod.id, party_size: partySize }),
    });
    const data = await resp.json();
    if (resp.ok) onSuccess(data.holdId, { /* you can pass back customer info if needed */ });
    else toast({ title: data.error || 'Hold failed', status: 'error', duration: 3000 });
  };
  return (
    <form onSubmit={handleCardSubmit} style={{ width: '100%' }}>
      <VStack spacing={5} align="stretch" w="full">
        {/* Card Number */}
        <Box
          w="full"
          h="60px"
          border="1px solid #ECEDE8"
          borderRadius="lg"
          p={4}
          bg="#ECEDE8"
          display="flex"
          alignItems="center"
        >
          <Box flex="1">
            <CardNumberElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#353535',
                    textAlign: 'center',
                    '::placeholder': { color: '#888' },
                    letterSpacing: '1px',
                  },
                },
              }}
            />
          </Box>
        </Box>
        {/* Expiry & CVC in one row */}
        <HStack spacing={2} w="full">
          <Box
            flex="1"
            h="60px"
            border="1px solid #ECEDE8"
            textAlign= 'center'
            borderRadius="lg"
            p={4}
            bg="#ECEDE8"
            display="flex"
            alignItems="center"
          >
            <Box flex="1">
              <CardExpiryElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#353535',
                      textAlign: 'center',
                      '::placeholder': { color: '#888' },
                    },
                  },
                }}
              />
            </Box>
          </Box>
          <Box
            flex="1"
            h="60px"
            border="1px solid #ECEDE8"
            borderRadius="lg"
            p={4}
            bg="#ECEDE8"
            display="flex"
            alignItems="center"
          >
            <Box flex="1">
              <CardCvcElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#353535',
                      textAlign: 'center',
                      '::placeholder': { color: '#888' },
                    },
                  },
                }}
              />
            </Box>
          </Box>
        </HStack>
        <Button
          type="submit"
          w="full"
          h="48px"
          borderRadius="full"
          bg="#353535"
          color="#A59480"
          fontSize="xl"
          fontWeight="bold"
          fontFamily="Montserrat, sans-serif"
          textTransform="uppercase"
          letterSpacing="0.1em"
          _hover={{ bg: '#222' }}
          transition="all 0.2s"
          boxShadow="2xl"
          mt={1}
        >
          RESERVE
        </Button>
      </VStack>
    </form>
  );
}

export default function Home() {
  const [bookingStartDate, setBookingStartDate] = useState(null);
  const [bookingEndDate, setBookingEndDate] = useState(null);
  const [baseDays, setBaseDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      // Fetch booking window from settings
      const { data: startData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'booking_start_date')
        .single();
      const { data: endData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'booking_end_date')
        .single();
      // Fetch baseDays from venue_hours
      const { data: baseData } = await supabase
        .from('venue_hours')
        .select('day_of_week')
        .eq('type', 'base')
        .gte('time_ranges', '[]');
      setBookingStartDate(startData && startData.value ? new Date(startData.value) : new Date());
      setBookingEndDate(endData && endData.value ? new Date(endData.value) : (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d; })());
      setBaseDays(Array.isArray(baseData) ? baseData.map(r => typeof r.day_of_week === 'string' ? Number(r.day_of_week) : r.day_of_week) : [1,2,3,4,5,6,0]);
      setLoading(false);
    }
    fetchConfig();
  }, []);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#ECEDE8]">
      {/* Top Navigation */}
      <nav className="w-full flex items-center justify-between px-8 py-6 bg-white/20 backdrop-blur-sm absolute top-0 left-0 z-20" style={{ color: '#ECEDE8' }}>
        <div className="flex items-center gap-2">
          <Image src="/images/noir-wedding-day.png" alt="Noir Logo" width={120} height={80} className="object-contain" />
        </div>
        <div className="flex gap-6 items-center text-lg font-medium">
          <a href="#reserve" className="ml-4 px-4 py-2 rounded" style={{ background: '#A59480', color: '#fff', fontWeight: 600, letterSpacing: '0.05em' }}>Reserve Now</a>
        </div>
      </nav>
      <main style={{ position: 'relative', zIndex: 10 }}>
        {/* Hero Section */}
        <section style={{ position: 'relative', width: '100vw', minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
          <Image
            src="/images/LPR67899.JPG"
            alt="Lounge interior"
            fill
            style={{ objectFit: 'cover', zIndex: 1 }}
            priority
          />
          {/* 20% Cork overlay */}
          <div style={{ background: 'rgba(165, 148, 128, 0.2)', position: 'absolute', inset: 0, zIndex: 2 }} />
          {/* Overlayed text and button */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#ECEDE8', padding: '0 1rem' }}>
            <h1 style={{ fontFamily: 'IvyJournal-Thin, serif', fontSize: '4rem', letterSpacing: '0.08em', fontWeight: 400, textTransform: 'uppercase', marginBottom: '1.5rem', lineHeight: 1.1 }}>
              ELEVATED SPIRITS.<br />UNFORGETTABLE SPACE.
            </h1>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.25rem', maxWidth: 600, margin: '0 auto 2.5rem auto', color: '#ECEDE8', fontWeight: 400 }}>
              Tucked in downtown Kansas City, Noir is a cocktail lounge designed for those who appreciate the art of ambiance. From signature drinks to interiors, every detail is crafted to elevate your evening. Sip, indulge, escape the ordinary.
            </p>
          </div>
        </section>
      </main>

      {/* Reservation Section */}
      <Elements stripe={stripePromise}>
        <section
          id="reserve"
          className="scroll-mt-28"
        >
          <ReservationSection
            baseDays={baseDays}
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
          />
        </section>
      </Elements>

      {/* Hours & Location Section */}
      <section className="bg-[#ECEDE8] py-20 flex flex-col md:flex-row items-center justify-center gap-12">
        <div className="flex-shrink-0">
          <Image src="/images/LPR66872.JPG" alt="Cocktails" width={450} height={350} className="rounded-2xl object-cover" />
        </div>
        <div className="flex flex-col items-center md:items-start">
          <h2 
            className="text-3xl md:text-3xl font-bold mb-2"
            style={{ 
              fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif',
              textTransform: 'uppercase',
              fontSize: '2.25rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: '#353535'
            }}
          >
            Hours & Location
          </h2>
          <h3> <a href="https://maps.google.com/?q=106 W. 11th St, Kansas City, Mo 68104" target="_blank" rel="noopener noreferrer" className="underline mb-2">106 W. 11th St, Kansas City, Mo 68104</a></h3>
          <div className="mb-4 text-[#353535]">
            <div>Thursday – 6pm-11pm</div>
            <div>Friday – 6pm-12am</div>
            <div>Saturday – 6pm-12am</div>
          </div>
        
        </div>
      </section>

      {/* Noir Menu Section */}
      <section className="bg-[#ABA8A1] py-16 flex flex-col items-center justify-center">
        {/* Section headers should use IvyJournal-Thin, all caps, moving forward */}
        <h3 
          className="text-3xl font-bold mb-4 text-center"
          style={{ 
            fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', 
            textTransform: 'uppercase',
            fontSize: '2.25rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: '#353535'
          }}
        >
          Noir Menu
        </h3>
        <p className="text-lg mb-8 text-center" style={{ fontFamily: 'Montserrat, sans-serif',fontWeight: 'semi-bold', color: '#ecede8' }}>
          Explore our curated selection of cocktails, spirits, and small plates. Enjoy the Noir experience.
        </p>
        <div style={{ width: '90vw', maxWidth: '900px', margin: '0 auto' }}>
          <Image src="/images/noir-menu.png" alt="Noir Menu" width={1200} height={1200} style={{ width: '100%', height: 'auto', borderRadius: '1.5rem', boxShadow: '0 8px 32px rgba(53,53,53,0.15)' }} />
        </div>
      </section>

      {/* Membership Section */}
      <section className="w-full flex flex-col items-center justify-center py-16 bg-[#ECEDE8]">
        <h2 style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 900,
          fontSize: '2.5rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#23201C',
          marginBottom: '2rem',
          textAlign: 'center',
        }}>THE MEMBERSHIP</h2>
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Main Membership Card */}
          <div className="bg-[#353535] rounded-2xl shadow-xl p-8 flex flex-col items-center border-4 border-[#BCA892] min-h-[340px]">
            <h4 className="font-serif text-2xl text-[#ECEDE8] mb-2" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>MEMBERSHIP</h4>
            <div className="text-3xl text-[#BCA892] font-semibold mb-3">$100<span className="text-lg font-normal">/mo</span></div>
            <ul className="text-[#ECEDE8] text-base mb-4 space-y-1 text-left">
              <li>• No deposit for reservations</li>
              <li>• You + up to 10 guests per visit</li>
              <li>• Unused credit rolls over each month</li>
              <li>• Curated events & member experiences</li>
              <li>• Monthly beverage credit</li>
              <li>• Concierge Reservations via Text</li>
              <li>• House account for seamless billing</li>
              <li>• Host Private Gatherings at Noir</li>
            </ul>
            <div className="text-xs text-[#BCA892] italic mt-auto">Limited availability</div>
          </div>
          
          {/* Add-ons Stacked Vertically */}
          <div className="flex flex-col gap-6">
            {/* Partner Add-on */}
            <div className="bg-[#353535] rounded-2xl shadow-xl p-6 flex flex-col items-center border border-[#3A362F] min-h-[160px] relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#BCA892] text-[#23201C] px-3 py-1 text-xs font-semibold rounded-bl-lg">
                ADD-ON
              </div>
              <h4 className="font-serif text-xl text-[#ECEDE8] mb-2 mt-2" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>PARTNER</h4>
              <div className="text-2xl text-[#BCA892] font-semibold mb-3">+$25<span className="text-base font-normal">/mo</span></div>
              <ul className="text-[#ECEDE8] text-sm mb-4 space-y-1 text-center">
                <li>Partner account (can visit without you)</li>
                <li>Shared beverage credit</li>
                <li>Shared House Account</li>
                <li>Same guest privileges</li>
              </ul>
              <div className="text-xs text-[#BCA892] italic mt-auto">Add to existing membership</div>
            </div>
            
            {/* Daytime Access Add-on */}
            <div className="bg-[#353535] rounded-2xl shadow-xl p-6 flex flex-col items-center border border-[#3A362F] min-h-[160px] relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#BCA892] text-[#23201C] px-3 py-1 text-xs font-semibold rounded-bl-lg">
                ADD-ON
              </div>
              <h4 className="font-serif text-xl text-[#ECEDE8] mb-2 mt-2" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>DAYTIME ACCESS</h4>
              <div className="text-2xl text-[#BCA892] font-semibold mb-3">+$500<span className="text-base font-normal">/mo</span></div>
              <ul className="text-[#ECEDE8] text-sm mb-4 space-y-1 text-center">
                <li>Day-time Access Mon–Friday 10am–5pm</li>
                <li>Quiet workspace, meeting & entertainment environment</li>
                <li>Priority booking for daytime hours</li>
                <li>Based on approval</li>
              </ul>
              <div className="text-xs text-[#BCA892] italic mt-auto">Add to existing membership</div>
            </div>
          </div>
        </div>
        <div className="w-full flex justify-center mt-10">
          <button 
            onClick={() => {
              const message = "MEMBER";
              const phoneNumber = "9137774488";
              const url = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
              window.open(url, '_blank');
            }}
            className="inline-block px-8 py-4 rounded-full bg-[#BCA892] text-[#23201C] text-lg font-semibold shadow-lg hover:bg-[#ECEDE8] transition-all duration-200" 
            style={{ fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}
          >
            Text MEMBER to 913.777.4488 for more information
          </button>
        </div>
      </section>

      {/* Private Events at Noir Section */}
      <section className="w-full py-16 bg-[#23201C] flex flex-col items-center justify-center">
        <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 px-4">
          {/* Text Content */}
          <div className="flex-1 text-left">
            <h2 className="mb-4 text-3xl md:text-4xl font-serif" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', color: '#ECEDE8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Private Events</h2>
            <h3 className="mb-4 text-xl md:text-2xl font-serif" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', color: '#BCA892', fontWeight: 400 }}>
              An intimate setting for your most unforgettable gatherings.
            </h3>
            <p className="mb-6 text-base md:text-lg" style={{ color: '#ECEDE8', fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
              Noir is available for private bookings—perfect for intimate celebrations, brand activations, or milestone moments. Enjoy a full-service experience with craft mixologists, bar staff, and elegant lounge hospitality.
            </p>
            <div className="mb-6 text-base md:text-lg space-y-1" style={{ color: '#BCA892', fontFamily: 'Montserrat, sans-serif' }}>
              <div><span className="font-semibold">Venue Rental:</span> $500/hr</div>
              <div><span className="font-semibold">Beverage Minimum:</span> $500/hr + sales tax</div>
              <div><span className="font-semibold">Outside catering allowed</span></div>
            </div>
            <a href="sms:9137774488?body=Hi%2C%20I%20am%20interested%20in%20booking%20a%20private%20event%20at%20Noir.%20Can%20you%20share%20availability%3F" className="inline-block px-8 py-4 rounded-full bg-[#BCA892] text-[#23201C] text-lg font-semibold shadow-lg hover:bg-[#ECEDE8] transition-all duration-200" style={{ fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}>
              Text Us for Availability
            </a>
          </div>
          {/* Image Content */}
          <div className="flex-1 flex justify-center items-center w-full">
            <img src="/images/LPR67921.JPG" alt="Noir Lounge" className="rounded-2xl shadow-xl object-cover w-full max-w-md h-72 md:h-96" style={{ background: '#353535' }} />
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer style={{ background: '#37322D', color: '#BCA892', width: '100%', padding: '2.5rem 0 2rem 0', marginTop: '0', borderTop: 'none' }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 3vw',
          flexWrap: 'wrap',
        }}>
          {/* Noir Logo */}
          <div style={{ flex: '1 1 300px', minWidth: '220px', display: 'flex', alignItems: 'center' }}>
            <img src="/images/noir-wedding-day.png" alt="Noir Logo" style={{ height: '90px', maxWidth: '320px', objectFit: 'contain', marginLeft: '0' }} />
          </div>
          {/* Location & Contact */}
          <div style={{ flex: '2 1 500px', display: 'flex', justifyContent: 'flex-end', gap: '5vw', minWidth: '320px', textAlign: 'left', fontFamily: 'Montserrat, serif', fontSize: '1.25rem' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Location</div>
              <div style={{ lineHeight: '1.5' }}>
                <a href="https://maps.google.com/?q=106 W. 11th St, Kansas City, MO 64105" target="_blank" rel="noopener noreferrer" style={{ color: '#BCA892', textDecoration: 'underline' }}>
                  106 W. 11th St,<br />
                  Kansas City, MO 64105
                </a>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Contact</div>
              <div style={{ lineHeight: '1.5' }}>
                <a href="mailto:drink@noirkc.com" style={{ color: '#BCA892', textDecoration: 'underline' }}>drink@noirkc.com</a><br />
                <a href="tel:9137774488" style={{ color: '#BCA892', textDecoration: 'underline' }}>913.777.4488</a>
              </div>
            </div>
          </div>
        </div>
        {/* Discreet Admin Access */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '1rem', 
          paddingTop: '1rem', 
          borderTop: '1px solid rgba(188, 168, 146, 0.2)',
          fontSize: '0.75rem',
          opacity: '0.6'
        }}>
          <a 
            href="/auth/admin" 
            style={{ 
              color: '#BCA892', 
              textDecoration: 'none',
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '0.7rem',
              letterSpacing: '0.05em'
            }}
          >
            admin
          </a>
        </div>
      </footer>
    </div>
  );
}