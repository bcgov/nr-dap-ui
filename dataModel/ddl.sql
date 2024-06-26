-- Description: This database schema defines the structure for the data extraction tool management system.
-- Author: Wei Zhang
-- Date: 4th June 2024
-- Dapui Schema (modify as needed)
CREATE SCHEMA IF NOT EXISTS dapui;



-- Table: user_visit_logs
CREATE TABLE IF NOT EXISTS dapui.user_visit_logs (
    log_id SERIAL PRIMARY KEY, -- Unique identifier for each log entry
    email VARCHAR(100) NOT NULL, -- User's email address
    idir_username VARCHAR(50) NOT NULL, -- User's IDIR username
    first_name VARCHAR(50) NOT NULL, -- User's first name
    last_name VARCHAR(50) NOT NULL, -- User's last name
    visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp when the visit was logged
);

-- Comments for user_visit_logs table
COMMENT ON TABLE dapui.user_visit_logs IS 'Stores logs of each user visit, including the time of visit';

-- Comments for columns in user_visit_logs table
COMMENT ON COLUMN dapui.user_visit_logs.log_id IS 'Unique identifier for a log entry';
COMMENT ON COLUMN dapui.user_visit_logs.email IS 'User''s email address';
COMMENT ON COLUMN dapui.user_visit_logs.idir_username IS 'User''s IDIR username';
COMMENT ON COLUMN dapui.user_visit_logs.first_name IS 'User''s first name';
COMMENT ON COLUMN dapui.user_visit_logs.last_name IS 'User''s last name';
COMMENT ON COLUMN dapui.user_visit_logs.visit_time IS 'Timestamp of when the user visited the resource';

-- Table: role
CREATE TABLE IF NOT EXISTS dapui.role (
    roleid SERIAL PRIMARY KEY, -- Unique identifier for a role
    rolename VARCHAR(50), -- Name of the role
    description TEXT -- Description of the role
);

-- Comments for role table
COMMENT ON TABLE dapui.role IS 'Stores information about user roles';

-- Comments for columns in role table
COMMENT ON COLUMN dapui.role.roleid IS 'Unique identifier for a role';
COMMENT ON COLUMN dapui.role.rolename IS 'Name of the role';
COMMENT ON COLUMN dapui.role.description IS 'Description of the role';

-- Table: user
CREATE TABLE IF NOT EXISTS dapui."user" (
    userid SERIAL PRIMARY KEY, -- Unique identifier for a user
    username VARCHAR(50), -- User's username
    firstname VARCHAR(50), -- User's first name
    lastname VARCHAR(50), -- User's last name
    email VARCHAR(100), -- User's email address
    roleid INT, -- Foreign key referencing role table
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp of user creation
    lastlogin TIMESTAMP, -- Timestamp of user's last login
    FOREIGN KEY (roleid) REFERENCES dapui.role(roleid) -- Relationship with role table
);

-- Comments for user table
COMMENT ON TABLE dapui."user" IS 'Stores information about users';

-- Comments for columns in user table
COMMENT ON COLUMN dapui."user".userid IS 'Unique identifier for a user';
COMMENT ON COLUMN dapui."user".username IS 'User''s username';
COMMENT ON COLUMN dapui."user".firstname IS 'User''s first name';
COMMENT ON COLUMN dapui."user".lastname IS 'User''s last name';
COMMENT ON COLUMN dapui."user".email IS 'User''s email address';
COMMENT ON COLUMN dapui."user".roleid IS 'Foreign key referencing role table';
COMMENT ON COLUMN dapui."user".createdat IS 'Timestamp of user creation';
COMMENT ON COLUMN dapui."user".lastlogin IS 'Timestamp of user''s last login';

-- Table: database
CREATE TABLE IF NOT EXISTS dapui."database" (
    databaseid SERIAL PRIMARY KEY, -- Unique identifier for a database
    databasename VARCHAR(100), -- Name of the database
    vaultname VARCHAR(100), -- Name of the vault
    applicationname VARCHAR(100), -- Name of the application
    schemaname VARCHAR(100), -- Name of the schema
    owneruserid INT, -- Foreign key referencing user table
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp of database creation
    FOREIGN KEY (owneruserid) REFERENCES dapui."user"(userid) -- Relationship with user table
);

-- Comments for database table
COMMENT ON TABLE dapui."database" IS 'Stores information about databases';

-- Comments for columns in database table
COMMENT ON COLUMN dapui."database".databaseid IS 'Unique identifier for a database';
COMMENT ON COLUMN dapui."database".databasename IS 'Name of the database';
COMMENT ON COLUMN dapui."database".vaultname IS 'Name of the vault';
COMMENT ON COLUMN dapui."database".applicationname IS 'Name of the application';
COMMENT ON COLUMN dapui."database".schemaname IS 'Name of the schema';
COMMENT ON COLUMN dapui."database".owneruserid IS 'Foreign key referencing user table';
COMMENT ON COLUMN dapui."database".createdat IS 'Timestamp of database creation';

-- Table: datatable
CREATE TABLE IF NOT EXISTS dapui.datatable (
    tableid SERIAL PRIMARY KEY, -- Unique identifier for a table
    tablename VARCHAR(100), -- Name of the table
    databaseid INT, -- Foreign key referencing database table
    applicationname VARCHAR(100), -- Name of the application
    owneruserid INT, -- Foreign key referencing user table
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp of table creation
    lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp of last modification
    FOREIGN KEY (databaseid) REFERENCES dapui."database"(databaseid), -- Relationship with database table
    FOREIGN KEY (owneruserid) REFERENCES dapui."user"(userid) -- Relationship with user table
);

-- Comments for datatable table
COMMENT ON TABLE dapui.datatable IS 'Stores information about data tables';

-- Comments for columns in datatable table
COMMENT ON COLUMN dapui.datatable.tableid IS 'Unique identifier for a table';
COMMENT ON COLUMN dapui.datatable.tablename IS 'Name of the table';
COMMENT ON COLUMN dapui.datatable.databaseid IS 'Foreign key referencing database table';
COMMENT ON COLUMN dapui.datatable.applicationname IS 'Name of the application';
COMMENT ON COLUMN dapui.datatable.owneruserid IS 'Foreign key referencing user table';
COMMENT ON COLUMN dapui.datatable.createdat IS 'Timestamp of table creation';
COMMENT ON COLUMN dapui.datatable.lastmodified IS 'Timestamp of last modification';

-- Create trigger to automatically update lastmodified timestamp
CREATE OR REPLACE FUNCTION dapui.update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.lastmodified = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_last_modified_trigger
BEFORE UPDATE ON dapui.datatable
FOR EACH ROW
EXECUTE FUNCTION dapui.update_last_modified();