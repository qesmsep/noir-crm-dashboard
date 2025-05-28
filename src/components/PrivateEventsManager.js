import React, { useState, useEffect } from 'react';
import { getPrivateEvents, createPrivateEvent, updatePrivateEvent, deletePrivateEvent } from '../../api/private_events';
import { format } from 'date-fns';
import { Button, Modal, Form, Table, Alert } from 'react-bootstrap';

const PrivateEventsManager = () => {
    const [events, setEvents] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_time: '',
        end_time: ''
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        try {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 3); // Load events for next 3 months
            const data = await getPrivateEvents(startDate, endDate);
            setEvents(data);
        } catch (err) {
            setError('Failed to load events');
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (selectedEvent) {
                await updatePrivateEvent(selectedEvent.id, formData);
            } else {
                await createPrivateEvent(formData);
            }
            setShowModal(false);
            loadEvents();
            resetForm();
        } catch (err) {
            setError('Failed to save event');
            console.error(err);
        }
    };

    const handleEdit = (event) => {
        setSelectedEvent(event);
        setFormData({
            title: event.title,
            description: event.description || '',
            start_time: format(new Date(event.start_time), "yyyy-MM-dd'T'HH:mm"),
            end_time: format(new Date(event.end_time), "yyyy-MM-dd'T'HH:mm")
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this event?')) {
            try {
                await deletePrivateEvent(id);
                loadEvents();
            } catch (err) {
                setError('Failed to delete event');
                console.error(err);
            }
        }
    };

    const resetForm = () => {
        setSelectedEvent(null);
        setFormData({
            title: '',
            description: '',
            start_time: '',
            end_time: ''
        });
    };

    return (
        <div className="p-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2>Private Events</h2>
                <Button variant="primary" onClick={() => {
                    resetForm();
                    setShowModal(true);
                }}>
                    Add New Event
                </Button>
            </div>

            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

            <Table striped bordered hover>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {events.map(event => (
                        <tr key={event.id}>
                            <td>{event.title}</td>
                            <td>{event.description}</td>
                            <td>{format(new Date(event.start_time), 'MMM d, yyyy h:mm a')}</td>
                            <td>{format(new Date(event.end_time), 'MMM d, yyyy h:mm a')}</td>
                            <td>
                                <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEdit(event)}>
                                    Edit
                                </Button>
                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(event.id)}>
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>{selectedEvent ? 'Edit Event' : 'New Event'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Title</Form.Label>
                            <Form.Control
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Start Time</Form.Label>
                            <Form.Control
                                type="datetime-local"
                                value={formData.start_time}
                                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>End Time</Form.Label>
                            <Form.Control
                                type="datetime-local"
                                value={formData.end_time}
                                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                required
                            />
                        </Form.Group>

                        <div className="d-flex justify-content-end">
                            <Button variant="secondary" className="me-2" onClick={() => setShowModal(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit">
                                {selectedEvent ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default PrivateEventsManager; 