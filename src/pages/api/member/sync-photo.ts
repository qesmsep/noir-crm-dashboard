import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Sync member photo URLs from various sources
 * For Tim's case, use the Typeform URL that's already working in admin
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For Tim Wirick specifically, set his known photo URL
    const timPhotoUrl = 'https://api.typeform.com/responses/files/3f15267f455228091fcd1a069d648accf74f129f925a89b8be76cab8285a74f7/tim.png';

    // Update Tim's profile photo
    const { data: timUpdate, error: timError } = await supabaseAdmin
      .from('members')
      .update({ profile_photo_url: timPhotoUrl })
      .or('email.eq.tim@828.life,phone.eq.+18584129797')
      .select();

    if (timError) {
      console.error('Error updating Tim photo:', timError);
    }

    res.status(200).json({
      success: true,
      message: 'Photo URLs synced',
      tim_update: timUpdate
    });
  } catch (error) {
    console.error('Sync photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}