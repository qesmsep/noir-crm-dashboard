'use client';

import Image from 'next/image';
import BookMenuViewer from '../components/BookMenuViewer';

export default function Home() {

  // Apple Maps link helper
  const appleMapsUrl = 'https://maps.apple.com/?address=106%20W%2011th%20St,Kansas%20City,MO%2064105';

  return (
    <div className="min-h-screen flex flex-col bg-[#ECEDE8]">
      {/** Membership announcement popup - DISABLED (membership info now in main content) */}
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
          {/* Reserve button hidden - memberships only */}
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
                lineHeight: 1.1,
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2)'
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

      {/* Membership Access Section - Replaces Reservation Form */}
      <section
        id="reserve"
        className="scroll-mt-20 sm:scroll-mt-24 bg-[#23201C] py-12 sm:py-16 md:py-20 px-4 sm:px-8"
      >
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#353535] rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 border border-[#3A362F]">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 sm:mb-8">
                <img
                  src="/images/noir-wedding-day.png"
                  alt="Noir KC"
                  className="h-16 sm:h-20 md:h-24 object-contain mx-auto"
                />
              </div>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6"
                style={{
                  fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#ECEDE8',
                  fontWeight: 600
                }}
              >
                <span style={{ color: '#BCA892' }}>Exclusive Access</span> is HERE.
              </h2>
              <p
                className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 max-w-2xl"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  color: '#ECEDE8',
                  lineHeight: 1.5
                }}
              >
                Noir is now exclusively for Members — access is granted while membership capacity remains.
              </p>
              <div className="mb-6 sm:mb-8 space-y-3">
                <p
                  className="text-lg sm:text-xl font-semibold"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    color: '#ECEDE8'
                  }}
                >
                  Limited memberships available.
                </p>
                <p
                  className="text-base sm:text-lg"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    color: '#BCA892'
                  }}
                >
                  To get access or ask questions:
                </p>
                <p
                  className="text-base sm:text-lg"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    color: '#ECEDE8'
                  }}
                >
                  Text <strong>MEMBERSHIP</strong> to{' '}
                  <a
                    href="sms:9137774488?body=MEMBERSHIP"
                    className="font-semibold underline hover:no-underline transition-all"
                    style={{ color: '#BCA892' }}
                    aria-label="Text MEMBERSHIP to 913.777.4488"
                  >
                    913.777.4488
                  </a>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <a
                  href="sms:9137774488?body=MEMBERSHIP"
                  className="mobile-button mobile-accessible px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-[#BCA892] text-[#23201C] text-base sm:text-lg font-semibold shadow-lg hover:bg-[#ECEDE8] transition-all duration-200 text-center active:scale-95"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    letterSpacing: '0.05em',
                    touchAction: 'manipulation'
                  }}
                  aria-label="Start SMS about membership"
                >
                  Text MEMBERSHIP
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile-Optimized Hours & Location Section */}
      <section className="bg-[#ECEDE8] py-12 sm:py-16 md:py-20 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 sm:gap-12">
          <div className="flex-shrink-0 w-full max-w-sm sm:max-w-md lg:max-w-lg">
            <Image 
              src="/images/002-20250911-noir-fall-25-©LoveProjectPhotography.jpg" 
              alt="Cocktails" 
              width={450} 
              height={350} 
              className="rounded-2xl object-cover w-full h-64 sm:h-80 lg:h-96 shadow-xl"
              style={{ objectPosition: 'center 65%' }}
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
              <div>Thursday – 4pm-10pm</div>
              <div>Friday – 6pm-12am</div>
              <div>Saturday – 6pm-12am</div>
            </div>
          </div>
        </div>
      </section>

      {/* Noir Menu Section - Inline Book Viewer */}
      <section className="bg-[#1A1A1A] py-16 sm:py-20 md:py-24 px-4 sm:px-8" id="menu">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center">
          <h3
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 text-center"
            style={{
              fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif',
              textTransform: 'uppercase',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: '#ECEDE8'
            }}
          >
            Noir Menu
          </h3>
          <p className="text-base sm:text-lg md:text-xl mb-10 sm:mb-12 md:mb-16 text-center max-w-2xl px-4"
             style={{
               fontFamily: 'Montserrat, sans-serif',
               fontWeight: 400,
               color: '#BCA892',
               lineHeight: 1.5
             }}>
            Explore our curated selection of elevated cocktails, mocktails, and spirits. Turn the pages to discover the Noir experience.
          </p>
          {/* Inline Book Menu Viewer */}
          <div className="w-full">
            <BookMenuViewer />
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
            
          </div>
        </div>
        <div className="w-full flex justify-center mt-8 sm:mt-10 px-4">
          <button 
            onClick={() => {
              const message = "MEMBERSHIP";
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
            aria-label="Text MEMBERSHIP to 913.777.4488 for membership information"
          >
            Text MEMBERSHIP to 913.777.4488 to get access
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
              <div><span className="font-semibold">*</span> private events are reserved for members</div>
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
        {/* Discreet Admin & Member Access */}
        <div className="text-center mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[#BCA892]/20">
          <div className="flex justify-center gap-4 sm:gap-6">
            <a 
              href="/auth/member-login" 
              className="text-[#BCA892] no-underline hover:text-[#ECEDE8] transition-colors"
              style={{ 
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.7rem',
                letterSpacing: '0.05em'
              }}
              aria-label="Member portal access"
            >
              member portal
            </a>
            <span 
              className="text-[#BCA892]/40"
              style={{ 
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.7rem'
              }}
            >
              |
            </span>
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
        </div>
      </footer>
    </div>
  );
}