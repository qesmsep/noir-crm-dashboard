/**
 * Convert HEIC photo to JPEG format
 * Usage: node scripts/convert-heic-photo.js <member_id>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const convert = require('heic-convert');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function convertPhoto(memberId) {
  try {
    // Get member data
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('member_id, first_name, last_name, photo')
      .eq('member_id', memberId)
      .single();

    if (memberError || !member) {
      throw new Error('Member not found');
    }

    console.log(`Converting photo for ${member.first_name} ${member.last_name}`);
    console.log(`Current photo URL: ${member.photo}`);

    // Download the image
    const response = await fetch(member.photo);
    const buffer = await response.buffer();

    console.log(`Downloaded ${buffer.length} bytes`);

    // Convert to JPEG using heic-convert
    const jpegBuffer = await convert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.9
    });

    console.log(`Converted to JPEG: ${jpegBuffer.length} bytes`);

    // Upload new JPEG version
    const fileName = `${member.member_id}-${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('member-photos')
      .upload(fileName, jpegBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('member-photos')
      .getPublicUrl(fileName);

    const newPhotoUrl = urlData.publicUrl;
    console.log(`Uploaded new photo: ${newPhotoUrl}`);

    // Update member record
    const { error: updateError } = await supabase
      .from('members')
      .update({ photo: newPhotoUrl })
      .eq('member_id', memberId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Successfully converted and updated photo!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const memberId = process.argv[2];
if (!memberId) {
  console.error('Usage: node scripts/convert-heic-photo.js <member_id>');
  console.error('Example: node scripts/convert-heic-photo.js f6f2aeee-b444-45ed-b5f2-48a94626dad2');
  process.exit(1);
}

convertPhoto(memberId);
