import { getSupabaseClient } from './supabaseClient';
const supabase = getSupabaseClient();

export const getPrivateEvents = async (startDate, endDate) => {
    const { data, error } = await supabase
        .from('private_events')
        .select('*')
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .eq('status', 'active')
        .order('start_time', { ascending: true });

    if (error) throw error;
    return data;
};

export const createPrivateEvent = async (eventData) => {
    const { data, error } = await supabase
        .from('private_events')
        .insert([eventData])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updatePrivateEvent = async (id, eventData) => {
    const { data, error } = await supabase
        .from('private_events')
        .update(eventData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deletePrivateEvent = async (id) => {
    const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getPrivateEventById = async (id) => {
    const { data, error } = await supabase
        .from('private_events')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
};

// API route handler
export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            // Get all active private events
            const { data, error } = await supabase
                .from('private_events')
                .select('*')
                .eq('status', 'active')
                .order('start_time', { ascending: true });

            if (error) {
                console.error('Error fetching private events:', error);
                return res.status(500).json({ error: error.message });
            }

            return res.status(200).json(data);
        } else {
            res.setHeader('Allow', ['GET']);
            return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        }
    } catch (error) {
        console.error('Error in private_events API:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
} 