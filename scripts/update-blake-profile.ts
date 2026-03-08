import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateBlakeProfile() {
  const waitlistId = 'd0388be8-6a6d-4688-b5ec-411904b05989';
  const memberId = 'bd22426b-699d-4f89-9a3e-b927493c4d9b';

  try {
    // Get waitlist entry with photo
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('address, city, state, zip_code, photo_url')
      .eq('id', waitlistId)
      .single();

    if (waitlistError || !waitlist) {
      console.error('Waitlist not found:', waitlistError);
      return;
    }

    console.log('Found waitlist data:', {
      address: waitlist.address,
      city: waitlist.city,
      state: waitlist.state,
      zip_code: waitlist.zip_code,
      has_photo: !!waitlist.photo_url
    });

    // Upload photo to Supabase Storage if it's a base64 image
    let photoUrl = null;
    if (waitlist.photo_url && waitlist.photo_url.startsWith('data:image')) {
      console.log('Uploading photo to storage...');

      // Extract base64 data
      const matches = waitlist.photo_url.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        const fileExt = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        const fileName = `member-photos/${memberId}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('member-photos')
          .upload(fileName, buffer, {
            contentType: `image/${fileExt}`,
            upsert: true
          });

        if (uploadError) {
          console.error('Photo upload failed:', uploadError);
        } else {
          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from('member-photos')
            .getPublicUrl(fileName);

          photoUrl = publicUrlData.publicUrl;
          console.log('Photo uploaded successfully:', photoUrl);
        }
      }
    } else if (waitlist.photo_url) {
      // It's already a URL
      photoUrl = waitlist.photo_url;
    }

    // Update member with all missing data
    console.log('Updating member profile...');
    const updateData: any = {
      address: waitlist.address,
      city: waitlist.city,
      state: waitlist.state,
      zip: waitlist.zip_code
    };

    if (photoUrl) {
      updateData.photo_url = photoUrl;
    }

    const { error: updateError } = await supabase
      .from('members')
      .update(updateData)
      .eq('member_id', memberId);

    if (updateError) {
      console.error('Failed to update member:', updateError);
      return;
    }

    console.log('✅ Successfully updated Blake\'s profile');
    console.log('Updated fields:', Object.keys(updateData));

  } catch (error) {
    console.error('Error:', error);
  }
}

updateBlakeProfile();
