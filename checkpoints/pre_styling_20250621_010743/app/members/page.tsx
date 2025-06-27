import React from 'react';

export default function MembersPage() {
  return (
    <main className="min-h-screen bg-[#23201C] flex flex-col items-center justify-start px-4 py-12">
      <section className="w-full max-w-5xl mx-auto text-center mb-12">
        <h1 className="font-serif text-4xl md:text-6xl text-[#ECEDE8] mb-4 tracking-wide" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 400 }}>Noir Membership</h1>
        <p className="text-lg md:text-2xl text-[#BCA892] max-w-2xl mx-auto mb-10 font-light">A hidden world of curated gatherings, exclusive access, and effortless hospitality.</p>
      </section>
      <section className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {/* Tier 1 */}
        <div className="bg-[#28251F] rounded-2xl shadow-xl p-8 flex flex-col items-center border border-[#3A362F]">
          <h2 className="font-serif text-2xl text-[#ECEDE8] mb-2" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Social</h2>
          <div className="text-3xl text-[#BCA892] font-semibold mb-4">$100<span className="text-lg font-normal">/mo</span></div>
          <ul className="text-[#ECEDE8] text-base mb-4 space-y-1">
            <li>Access to Noir lounge</li>
            <li>Priority reservations</li>
            <li>Member events</li>
          </ul>
          <div className="text-[#BCA892] text-sm mb-2">Guest policy: Up to 2 guests per visit</div>
          <div className="text-xs text-[#BCA892] italic">Limited availability</div>
        </div>
        {/* Tier 2 */}
        <div className="bg-[#28251F] rounded-2xl shadow-xl p-8 flex flex-col items-center border-2 border-[#BCA892] scale-105">
          <h2 className="font-serif text-2xl text-[#ECEDE8] mb-2" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Premier</h2>
          <div className="text-3xl text-[#BCA892] font-semibold mb-4">$250<span className="text-lg font-normal">/mo</span></div>
          <ul className="text-[#ECEDE8] text-base mb-4 space-y-1">
            <li>All Social perks</li>
            <li>Private event invitations</li>
            <li>Complimentary bottle service (monthly)</li>
          </ul>
          <div className="text-[#BCA892] text-sm mb-2">Guest policy: Up to 4 guests per visit</div>
          <div className="text-xs text-[#BCA892] italic">Limited availability</div>
        </div>
        {/* Tier 3 */}
        <div className="bg-[#28251F] rounded-2xl shadow-xl p-8 flex flex-col items-center border border-[#3A362F]">
          <h2 className="font-serif text-2xl text-[#ECEDE8] mb-2" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Founders</h2>
          <div className="text-3xl text-[#BCA892] font-semibold mb-4">$500<span className="text-lg font-normal">/mo</span></div>
          <ul className="text-[#ECEDE8] text-base mb-4 space-y-1">
            <li>All Premier perks</li>
            <li>Annual private dinner</li>
            <li>Personalized locker</li>
          </ul>
          <div className="text-[#BCA892] text-sm mb-2">Guest policy: Up to 6 guests per visit</div>
          <div className="text-xs text-[#BCA892] italic">Limited availability</div>
        </div>
      </section>
      <div className="w-full flex justify-center">
        <a href="https://noirmembership.typeform.com/to/yourtypeform" target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-4 rounded-full bg-[#BCA892] text-[#23201C] text-lg font-semibold shadow-lg hover:bg-[#ECEDE8] transition-all duration-200" style={{ fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}>
          Join the Waitlist
        </a>
      </div>
    </main>
  );
} 