import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

async function verifyAdmin(req: NextApiRequest): Promise<boolean> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('access_level')
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .single();

  return !!admin;
}

const VALID_STATUSES = ['draft', 'active', 'inactive'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // All intake-campaigns operations require admin auth
  if (!(await verifyAdmin(req))) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  if (req.method === 'GET') {
    try {
      const { id } = req.query;

      if (id) {
        // Get single campaign with messages
        const { data: campaign, error } = await supabaseAdmin
          .from('sms_intake_campaigns')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        const { data: messages, error: msgError } = await supabaseAdmin
          .from('sms_intake_campaign_messages')
          .select('*')
          .eq('campaign_id', id)
          .order('sort_order', { ascending: true });

        if (msgError) throw msgError;

        return res.status(200).json({ ...campaign, messages: messages || [] });
      }

      // List all campaigns with message counts
      const { data: campaigns, error } = await supabaseAdmin
        .from('sms_intake_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get message counts for each campaign
      const campaignIds = (campaigns || []).map(c => c.id);
      let messageCounts: Record<string, number> = {};

      if (campaignIds.length > 0) {
        const { data: counts } = await supabaseAdmin
          .from('sms_intake_campaign_messages')
          .select('campaign_id')
          .in('campaign_id', campaignIds);

        if (counts) {
          for (const row of counts) {
            messageCounts[row.campaign_id] = (messageCounts[row.campaign_id] || 0) + 1;
          }
        }
      }

      const result = (campaigns || []).map(c => ({
        ...c,
        message_count: messageCounts[c.id] || 0,
      }));

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching intake campaigns:', error);
      return res.status(500).json({ error: 'Failed to fetch intake campaigns' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, trigger_word, status, messages, actions, non_member_response } = req.body;

      if (!name || !trigger_word) {
        return res.status(400).json({ error: 'Name and trigger word are required' });
      }

      if (!messages || messages.length === 0) {
        return res.status(400).json({ error: 'At least one message is required' });
      }

      const campaignStatus = status || 'draft';
      if (!VALID_STATUSES.includes(campaignStatus)) {
        return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
      }

      // Create campaign
      const { data: campaign, error } = await supabaseAdmin
        .from('sms_intake_campaigns')
        .insert({
          name,
          trigger_word: trigger_word.trim(),
          status: campaignStatus,
          actions: actions || {},
          non_member_response: non_member_response || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'A campaign with this trigger word already exists' });
        }
        throw error;
      }

      // Insert messages
      const messageRows = messages.map((msg: any, index: number) => ({
        campaign_id: campaign.id,
        message_content: msg.message_content,
        delay_minutes: msg.delay_minutes || 0,
        send_time: msg.send_time || null,
        sort_order: index,
      }));

      const { error: msgError } = await supabaseAdmin
        .from('sms_intake_campaign_messages')
        .insert(messageRows);

      if (msgError) throw msgError;

      return res.status(201).json(campaign);
    } catch (error) {
      console.error('Error creating intake campaign:', error);
      return res.status(500).json({ error: 'Failed to create intake campaign' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, name, trigger_word, status, messages, actions, non_member_response } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Campaign ID is required' });
      }

      // Update campaign
      if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
      }

      const updateFields: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateFields.name = name;
      if (trigger_word !== undefined) updateFields.trigger_word = trigger_word.trim();
      if (status !== undefined) updateFields.status = status;
      if (actions !== undefined) updateFields.actions = actions;
      if (non_member_response !== undefined) updateFields.non_member_response = non_member_response;

      const { data: campaign, error } = await supabaseAdmin
        .from('sms_intake_campaigns')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'A campaign with this trigger word already exists' });
        }
        throw error;
      }

      // If messages provided, replace all messages
      if (messages) {
        // Delete existing messages
        await supabaseAdmin
          .from('sms_intake_campaign_messages')
          .delete()
          .eq('campaign_id', id);

        // Insert new messages
        if (messages.length > 0) {
          const messageRows = messages.map((msg: any, index: number) => ({
            campaign_id: id,
            message_content: msg.message_content,
            delay_minutes: msg.delay_minutes || 0,
            send_time: msg.send_time || null,
            sort_order: index,
          }));

          const { error: msgError } = await supabaseAdmin
            .from('sms_intake_campaign_messages')
            .insert(messageRows);

          if (msgError) throw msgError;
        }
      }

      return res.status(200).json(campaign);
    } catch (error) {
      console.error('Error updating intake campaign:', error);
      return res.status(500).json({ error: 'Failed to update intake campaign' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Campaign ID is required' });
      }

      const { error } = await supabaseAdmin
        .from('sms_intake_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting intake campaign:', error);
      return res.status(500).json({ error: 'Failed to delete intake campaign' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
