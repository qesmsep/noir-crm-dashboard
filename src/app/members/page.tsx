import React from 'react';

export default function MembersPage() {
  return (
    <main className="min-h-screen bg-[#23201C] flex flex-col items-center justify-start px-4 py-12">
      <section className="w-full max-w-5xl mx-auto text-center mb-12">
        <h1 className="font-serif text-4xl md:text-6xl text-[#ECEDE8] mb-4 tracking-wide" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 400 }}>Noir Membership</h1>
        <p className="text-lg md:text-2xl text-[#BCA892] max-w-2xl mx-auto mb-10 font-light">A hidden world of curated gatherings, exclusive access, and effortless hospitality.</p>
      </section>
      <section className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {/* Main Membership Card */}
        <div className="bg-[#28251F] rounded-2xl shadow-xl p-8 flex flex-col items-center border-4 border-[#BCA892] min-h-[340px]">
          <h2 className="font-serif text-2xl text-[#ECEDE8] mb-2" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>MEMBERSHIP</h2>
          <div className="text-3xl text-[#BCA892] font-semibold mb-4">$100<span className="text-lg font-normal">/mo</span></div>
          <ul className="text-[#ECEDE8] text-base mb-4 space-y-1 text-left">
            <li>• Access to Noir lounge</li>
            <li>• Priority reservations</li>
            <li>• Member events</li>
            <li>• No deposit for make reservations</li>
            <li>• Curated events & member experiences</li>
            <li>• Monthly beverage credit</li>
            <li>• Concierge Reservations via Text</li>
            <li>• House account for seamless billing</li>
            <li>• Host Private Gatherings at Noir</li>
          </ul>
          <div className="text-xs text-[#BCA892] italic mt-auto">Limited availability</div>
        </div>
        {/* Partner Add-on */}
        <div className="bg-[#28251F] rounded-2xl shadow-xl p-6 flex flex-col items-center border border-[#3A362F] min-h-[340px] relative overflow-hidden">
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
        <div className="bg-[#28251F] rounded-2xl shadow-xl p-6 flex flex-col items-center border border-[#3A362F] min-h-[340px] relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#BCA892] text-[#23201C] px-3 py-1 text-xs font-semibold rounded-bl-lg">
            ADD-ON
          </div>
          <h4 className="font-serif text-xl text-[#ECEDE8] mb-2 mt-2" style={{ fontFamily: 'IvyJournalThin, IvyJournal-Thin, serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>DAYTIME ACCESS</h4>
          <div className="text-2xl text-[#BCA892] font-semibold mb-3">+$250<span className="text-base font-normal">/mo</span></div>
          <ul className="text-[#ECEDE8] text-sm mb-4 space-y-1 text-center">
            <li>Day-time Access Mon–Friday 10am–5pm</li>
            <li>Private workspace environment</li>
            <li>Exclusive daytime events</li>
            <li>Priority booking for daytime hours</li>
          </ul>
          <div className="text-xs text-[#BCA892] italic mt-auto">Add to existing membership</div>
        </div>
      </section>
      <div className="w-full flex justify-center mt-10">
        <a href="https://noirmembership.typeform.com/to/yourtypeform" target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-4 rounded-full bg-[#BCA892] text-[#23201C] text-lg font-semibold shadow-lg hover:bg-[#ECEDE8] transition-all duration-200" style={{ fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}>
          Join the Waitlist
        </a>
      </div>
    </main>
  );
} 