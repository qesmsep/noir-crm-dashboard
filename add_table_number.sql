ALTER TABLE reservations ADD COLUMN table_number INTEGER REFERENCES tables(number);
