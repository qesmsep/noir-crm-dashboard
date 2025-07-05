'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useDisclosure, Box, VStack, Text, Button, Input, Select, HStack, IconButton, Center, useToast, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, DrawerCloseButton, FormControl, FormLabel, Heading } from '@chakra-ui/react';
import { AddIcon, MinusIcon, ChevronDownIcon } from '@chakra-ui/icons';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import { getSupabaseClient } from '../pages/api/supabaseClient';
import ReservationForm from '../components/ReservationForm';
import ReservationSection from '../components/ReservationSection';
import Modal from 'react-modal';
import { useSettings } from '../context/SettingsContext';
import MenuViewer from '../components/MenuViewer';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function InlineStripeForm({ partySize, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const { settings } = useSettings();

  const handleCardSubmit = async (e) => {
    e.preventDefault && e.preventDefault();
    if (!stripe || !elements) return;
    
    // If hold fee is disabled, skip payment processing
    if (!settings.hold_fee_enabled) {
      onSuccess('no-hold', { /* you can pass back customer info if needed */ });
      return;
    }

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
      body: JSON.stringify({ payment_method_id: paymentMethod.id, amount: settings.hold_fee_amount }),
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
  const [menuModalOpen, setMenuModalOpen] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      // Fetch booking window from settings
      const supabase = getSupabaseClient();
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
    return (
      <div className="min-h-screen flex flex-col bg-[#ECEDE8] items-center justify-center">
        <div className="text-2xl sm:text-3xl font-medium text-[#353535]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Loading...
        </div>
      </div>
    );
  }

  // Apple Maps link helper
  const appleMapsUrl = 'https://maps.apple.com/?address=106%20W%2011th%20St,Kansas%20City,MO%2064105';

  return (
    <div className="min-h-screen flex flex-col bg-[#ECEDE8]">
      {/* Mobile-Optimized Navigation - Overlay on Hero */}
      <nav className="absolute top-0 left-0 right-0 w-full flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 bg-white/20 backdrop-blur-sm z-50" style={{ color: '#ECEDE8' }}>
        <div className="flex items-center gap-2">
          <Image 
            src="/images/noir-wedding-day.png" 
            alt="Noir Logo" 
            width={60} 
            height={45} 
            className="object-contain sm:w-[100px] sm:h-[70px] lg:w-[120px] lg:h-[80px]" 
            priority
          />
        </div>
        <div className="flex gap-2 sm:gap-4 items-center">
          <a 
            href="#reserve" 
            className="mobile-accessible px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 hover:bg-[#8B7A6A] active:scale-95" 
            style={{ 
              background: '#A59480', 
              color: '#fff', 
              fontWeight: 600, 
              letterSpacing: '0.05em',
              touchAction: 'manipulation'
            }}
            aria-label="Reserve a table"
          >
            Reserve
          </a>
        </div>
      </nav>

      <main style={{ position: 'relative', zIndex: 10 }}>
        {/* Mobile-Optimized Hero Section */}
        <section className="hero-section relative w-full min-h-screen h-screen overflow-hidden">
          <Image
            src="/images/LPR67899.JPG"
            alt="Lounge interior"
            fill
            style={{ objectFit: 'cover', zIndex: 1 }}
            priority
            className="responsive-image"
          />
          {/* 20% Cork overlay */}
          <div style={{ background: 'rgba(165, 148, 128, 0.2)', position: 'absolute', inset: 0, zIndex: 2 }} />
          {/* Mobile-optimized text and button */}
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center text-center text-[#ECEDE8] px-4 sm:px-8">
            <h1 
              className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl mb-4 sm:mb-6 leading-tight"
              style={{ 
                fontFamily: 'IvyJournal-Thin, serif', 
                letterSpacing: '0.08em', 
                fontWeight: 400, 
                textTransform: 'uppercase',
                lineHeight: 1.1
              }}
            >
              ELEVATED SPIRITS.<br />UNFORGETTABLE SPACE.
            </h1>
            <p 
              className="mobile-text font-sans text-base sm:text-lg md:text-xl lg:text-2xl max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto mb-6 sm:mb-8 md:mb-10 px-2"
              style={{ 
                fontFamily: 'Montserrat, sans-serif', 
                color: '#ECEDE8', 
                fontWeight: 400,
                lineHeight: 1.4
              }}
            >
              Tucked in downtown Kansas City, Noir is a cocktail lounge designed for those who appreciate the art of ambiance. From signature drinks to interiors, every detail is crafted to elevate your evening. Sip, indulge, escape the ordinary.
            </p>
          </div>
        </section>
      </main>

      {/* Mobile-Optimized Reservation Section */}
      <Elements stripe={stripePromise}>
        <section
          id="reserve"
          className="scroll-mt-20 sm:scroll-mt-24"
        >
          <ReservationSection
            baseDays={baseDays}
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
          />
        </section>
      </Elements>

      {/* Mobile-Optimized Hours & Location Section */}
      <section className="bg-[#ECEDE8] py-12 sm:py-16 md:py-20 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 sm:gap-12">
          <div className="flex-shrink-0 w-full max-w-sm sm:max-w-md lg:max-w-lg">
            <Image 
              src="/images/LPR69138.JPG" 
              alt="Cocktails" 
              width={450} 
              height={350} 
              className="rounded-2xl object-cover w-full h-64 sm:h-80 lg:h-96 shadow-xl"
              style={{ objectPosition: 'bottom center' }}
            />
          </div>
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6"
              style={{ 
                fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: '#353535'
              }}
            >
              Hours & Location
            </h2>
            <a 
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline mb-4 sm:mb-6 text-base sm:text-lg text-[#353535] hover:text-[#A59480] transition-colors"
              aria-label="Open location in Apple Maps"
            >
              106 W. 11th St, Kansas City, MO 64105
            </a>
            <div className="mb-4 sm:mb-6 text-[#353535] text-base sm:text-lg space-y-1">
              <div>Thursday – 6pm-11pm</div>
              <div>Friday – 6pm-12am</div>
              <div>Saturday – 6pm-12am</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile-Optimized Noir Menu Section */}
      <section className="bg-[#ABA8A1] py-36 sm:py-32 px-4 sm:px-8;">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center">
          <h3 
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-center"
            style={{ 
              fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif',
              marginTop: '100px',
              textTransform: 'uppercase',
              fontWeight: 900,
              letterSpacing: '0.08em',
              color: '#353535'
            }}
          >
            Noir Menu
          </h3>
          <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-center max-w-2xl px-4" 
             style={{ 
               fontFamily: 'Montserrat, sans-serif',
               fontWeight: 'semi-bold', 
               color: '#ecede8',
               lineHeight: 1.5
             }}>
            Explore our curated selection of cocktails, spirits, and small plates. Enjoy the Noir experience.
          </p>
          <div className="w-full max-w-4xl mx-auto px-4 flex justify-center">
            <button
              onClick={() => setMenuModalOpen(true)}
              className="mobile-button mobile-accessible px-6 py-3 rounded-full bg-[#BCA892] text-[#23201C] text-lg font-semibold shadow-lg hover:bg-[#ECEDE8] transition-all duration-200 text-center active:scale-95"
              style={{ fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em', touchAction: 'manipulation', minWidth: 180, marginBottom: '100px' }}
              aria-label="View Noir Menu"
            >
              View Menu
            </button>
          </div>
        </div>
      </section>

      {/* Mobile-Optimized Membership Section */}
      <section className="w-full flex flex-col items-center justify-center py-12 sm:py-16 px-4 sm:px-8 bg-[#ECEDE8]">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6 sm:mb-8 md:mb-12 text-center px-4"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#23201C',
            }}>
          THE MEMBERSHIP
        </h2>
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Main Membership Card */}
          <div className="bg-[#353535] rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col items-center border-4 border-[#BCA892] min-h-[300px] sm:min-h-[340px]">
            <h4 className="font-serif text-xl sm:text-2xl text-[#ECEDE8] mb-2 sm:mb-3" 
                style={{ 
                  fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em', 
                  fontWeight: 600 
                }}>
              MEMBERSHIP
            </h4>
            <div className="text-2xl sm:text-3xl text-[#BCA892] font-semibold mb-3 sm:mb-4">
              $100<span className="text-base sm:text-lg font-normal">/mo</span>
            </div>
            <ul className="text-[#ECEDE8] text-sm sm:text-base mb-4 sm:mb-6 space-y-1 text-left">
              <li>• $100 Monthly beverage credit</li>
              <li>• Unused credit rolls over each month</li>
              <li>• No deposit for reservations</li>
              <li>• You + up to 10 guests per visit</li>
              
              <li>• Curated events & member experiences</li>
             
              <li>• Concierge Reservations via Text</li>
              <li>• House account for seamless billing</li>
              <li>• Host Private Gatherings at Noir</li>
            </ul>
            <div className="text-xs text-[#BCA892] italic mt-auto">Limited availability</div>
          </div>
          
          {/* Add-ons Stacked Vertically */}
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Partner Add-on */}
            <div className="bg-[#353535] rounded-2xl shadow-xl p-4 sm:p-6 flex flex-col items-center border border-[#3A362F] min-h-[140px] sm:min-h-[160px] relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#BCA892] text-[#23201C] px-2 sm:px-3 py-1 text-xs font-semibold rounded-bl-lg">
                ADD-ON
              </div>
              <h4 className="font-serif text-lg sm:text-xl text-[#ECEDE8] mb-2 mt-2" 
                  style={{ 
                    fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.08em', 
                    fontWeight: 600 
                  }}>
                PARTNER
              </h4>
              <div className="text-xl sm:text-2xl text-[#BCA892] font-semibold mb-3">
                +$25<span className="text-sm sm:text-base font-normal">/mo</span>
              </div>
              <ul className="text-[#ECEDE8] text-xs sm:text-sm mb-4 space-y-1 text-center">
                <li>Partner account (can visit without you)</li>
                <li>Shared beverage credit</li>
                <li>Shared House Account</li>
                <li>Same guest privileges</li>
              </ul>
              <div className="text-xs text-[#BCA892] italic mt-auto">Add to existing membership</div>
            </div>
            
            {/* Daytime Access Add-on */}
            <div className="bg-[#353535] rounded-2xl shadow-xl p-4 sm:p-6 flex flex-col items-center border border-[#3A362F] min-h-[140px] sm:min-h-[160px] relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#BCA892] text-[#23201C] px-2 sm:px-3 py-1 text-xs font-semibold rounded-bl-lg">
                ADD-ON
              </div>
              <h4 className="font-serif text-lg sm:text-xl text-[#ECEDE8] mb-2 mt-2" 
                  style={{ 
                    fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.08em', 
                    fontWeight: 600 
                  }}>
                DAYTIME ACCESS
              </h4>
              <div className="text-xl sm:text-2xl text-[#BCA892] font-semibold mb-3">
                +$500<span className="text-sm sm:text-base font-normal">/mo</span>
              </div>
              <ul className="text-[#ECEDE8] text-xs sm:text-sm mb-4 space-y-1 text-center">
                <li>Day-time Access Mon–Friday 10am–5pm</li>
                <li>Quiet workspace, meeting & entertainment environment</li>
                <li>Priority booking for daytime hours</li>
                <li>Based on approval</li>
              </ul>
              <div className="text-xs text-[#BCA892] italic mt-auto">Add to existing membership</div>
            </div>
          </div>
        </div>
        <div className="w-full flex justify-center mt-8 sm:mt-10 px-4">
          <button 
            onClick={() => {
              const message = "MEMBER";
              const phoneNumber = "9137774488";
              const url = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
              window.open(url, '_blank');
            }}
            className="mobile-button mobile-accessible inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-[#BCA892] text-[#23201C] text-base sm:text-lg font-semibold shadow-lg hover:bg-[#ECEDE8] transition-all duration-200 text-center active:scale-95" 
            style={{ 
              fontFamily: 'Montserrat, sans-serif', 
              letterSpacing: '0.05em',
              touchAction: 'manipulation'
            }}
            aria-label="Text MEMBER to 913.777.4488 for membership information"
          >
            Text MEMBER to 913.777.4488 for more information
          </button>
        </div>
      </section>

      {/* Mobile-Optimized Private Events Section */}
      <section className="w-full py-12 sm:py-16 px-4 sm:px-8 bg-[#23201C] flex flex-col items-center justify-center">
        <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-8 sm:gap-12">
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <h2 className="mb-4 text-2xl sm:text-3xl md:text-4xl font-serif" 
                style={{ 
                  fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', 
                  color: '#ECEDE8', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em', 
                  fontWeight: 600 
                }}>
              Private Events
            </h2>
            <h3 className="mb-4 text-lg sm:text-xl md:text-2xl font-serif" 
                style={{ 
                  fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', 
                  color: '#BCA892', 
                  fontWeight: 400 
                }}>
              An intimate setting for your most unforgettable gatherings.
            </h3>
            <p className="mb-6 text-sm sm:text-base md:text-lg" 
               style={{ 
                 color: '#ECEDE8', 
                 fontFamily: 'Montserrat, sans-serif', 
                 fontWeight: 400,
                 lineHeight: 1.5
               }}>
              Noir is available for private bookings—perfect for intimate celebrations, brand activations, or milestone moments. Enjoy a full-service experience with craft mixologists, bar staff, and elegant lounge hospitality.
            </p>
            <div className="mb-6 text-sm sm:text-base md:text-lg space-y-1" 
                 style={{ 
                   color: '#BCA892', 
                   fontFamily: 'Montserrat, sans-serif' 
                 }}>
              <div><span className="font-semibold">Venue Rental:</span> $500/hr</div>
              <div><span className="font-semibold">Beverage Minimum:</span> $500/hr + sales tax</div>
              <div><span className="font-semibold">Outside catering allowed</span></div>
            </div>
            <a 
              href="sms:9137774488?body=Hi%2C%20I%20am%20interested%20in%20booking%20a%20private%20event%20at%20Noir.%20Can%20you%20share%20availability%3F" 
              className="mobile-button mobile-accessible inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-[#BCA892] text-[#23201C] text-base sm:text-lg font-semibold shadow-lg hover:bg-[#ECEDE8] transition-all duration-200 text-center active:scale-95"
              style={{ 
                fontFamily: 'Montserrat, sans-serif', 
                letterSpacing: '0.05em',
                touchAction: 'manipulation'
              }}
              aria-label="Text us for private event availability"
            >
              Text Us for Availability
            </a>
          </div>
          {/* Image Content */}
          <div className="flex-1 flex justify-center items-center w-full">
            <img 
              src="/images/LPR67921.JPG" 
              alt="Noir Lounge" 
              className="rounded-2xl shadow-xl object-cover w-full max-w-sm sm:max-w-md h-64 sm:h-72 md:h-96" 
              style={{ background: '#353535' }} 
            />
          </div>
        </div>
      </section>

      {/* Mobile-Optimized Footer Section */}
      <footer className="bg-[#37322D] text-[#BCA892] w-full py-8 sm:py-10 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
          {/* Noir Logo */}
          <div className="flex-1 flex justify-center lg:justify-start">
            <img 
              src="/images/noir-wedding-day.png" 
              alt="Noir Logo" 
              className="h-16 sm:h-20 lg:h-24 max-w-48 sm:max-w-64 lg:max-w-80 object-contain" 
            />
          </div>
          {/* Location & Contact */}
          <div className="flex flex-col sm:flex-row justify-center lg:justify-end gap-6 sm:gap-8 lg:gap-12 text-center lg:text-left">
            <div>
              <div className="font-semibold text-lg sm:text-xl mb-2 sm:mb-3">Location</div>
              <div className="text-sm sm:text-base leading-relaxed">
                <a 
                  href={appleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#BCA892] underline hover:text-[#ECEDE8] transition-colors"
                  aria-label="Open location in Apple Maps"
                >
                  106 W. 11th St,<br />
                  Kansas City, MO 64105
                </a>
              </div>
            </div>
            <div>
              <div className="font-semibold text-lg sm:text-xl mb-2 sm:mb-3">Contact</div>
              <div className="text-sm sm:text-base leading-relaxed">
                <a 
                  href="mailto:drink@noirkc.com" 
                  className="text-[#BCA892] underline hover:text-[#ECEDE8] transition-colors block mb-1"
                  aria-label="Send email to drink@noirkc.com"
                >
                  drink@noirkc.com
                </a>
                <a 
                  href="tel:9137774488" 
                  className="text-[#BCA892] underline hover:text-[#ECEDE8] transition-colors"
                  aria-label="Call 913.777.4488"
                >
                  913.777.4488
                </a>
              </div>
            </div>
          </div>
        </div>
        {/* Discreet Admin Access */}
        <div className="text-center mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[#BCA892]/20">
          <a 
            href="/auth/admin" 
            className="text-[#BCA892] no-underline hover:text-[#ECEDE8] transition-colors"
            style={{ 
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '0.7rem',
              letterSpacing: '0.05em'
            }}
            aria-label="Admin access"
          >
            admin
          </a>
        </div>
      </footer>

      {/* Noir Menu Modal using react-modal */}
      <Modal
        isOpen={menuModalOpen}
        onRequestClose={() => setMenuModalOpen(false)}
        contentLabel="Noir Menu Modal"
        style={{
          overlay: { 
            backgroundColor: 'rgba(0,0,0,0.9)', 
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          },
          content: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: '90vw',
            height: 'auto',
            margin: 'auto',
            background: '#23201C',
            border: 'none',
            borderRadius: '1.5rem',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2001,
            overflow: 'auto',
            position: 'relative'
          }
        }}
        ariaHideApp={false}
      >
        <button
          onClick={() => setMenuModalOpen(false)}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(53,53,53,0.8)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 40,
            height: 40,
            fontSize: 24,
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}
          aria-label="Close Menu"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-[#ECEDE8] mb-4" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Noir Menu</h2>
        <MenuViewer />
      </Modal>
    </div>
  );
}