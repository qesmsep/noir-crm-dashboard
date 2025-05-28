import { supabase } from '../supabaseClient';

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