import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { getPrivateEventById } from '../../api/private_events';
import { createReservation } from '../../api/reservations';
import { format } from 'date-fns';

const PrivateEventReservationModal = ({ show, onHide, eventId, tables }) => {
    const [event, setEvent] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        party_size: 2,
        notes: '',
        table_id: ''
    });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && eventId) {
            loadEvent();
        }
    }, [show, eventId]);

    const loadEvent = async () => {
        try {
            const eventData = await getPrivateEventById(eventId);
            setEvent(eventData);
        } catch (err) {
            setError('Failed to load event details');
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const reservationData = {
                ...formData,
                start_time: event.start_time,
                end_time: event.end_time,
                is_private_event: true,
                private_event_id: eventId
            };

            await createReservation(reservationData);
            onHide();
            setFormData({
                name: '',
                phone: '',
                email: '',
                party_size: 2,
                notes: '',
                table_id: ''
            });
        } catch (err) {
            setError('Failed to create reservation');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!event) return null;

    return (
        <Modal show={show} onHide={onHide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Reserve for {event.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="mb-4">
                    <h5>Event Details</h5>
                    <p><strong>Date:</strong> {format(new Date(event.start_time), 'EEEE, MMMM d, yyyy')}</p>
                    <p><strong>Time:</strong> {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}</p>
                    {event.description && <p><strong>Description:</strong> {event.description}</p>}
                </div>

                {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Name</Form.Label>
                        <Form.Control
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Phone</Form.Label>
                        <Form.Control
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Party Size</Form.Label>
                        <Form.Control
                            type="number"
                            min="1"
                            value={formData.party_size}
                            onChange={(e) => setFormData({ ...formData, party_size: parseInt(e.target.value) })}
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Table</Form.Label>
                        <Form.Select
                            value={formData.table_id}
                            onChange={(e) => setFormData({ ...formData, table_id: e.target.value })}
                            required
                        >
                            <option value="">Select a table</option>
                            {tables.map(table => (
                                <option key={table.id} value={table.id}>
                                    Table {table.name} (Capacity: {table.capacity})
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Special Requests</Form.Label>
                        <Form.Control
                            as="textarea"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </Form.Group>

                    <div className="d-flex justify-content-end">
                        <Button variant="secondary" className="me-2" onClick={onHide}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Reservation'}
                        </Button>
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default PrivateEventReservationModal; 