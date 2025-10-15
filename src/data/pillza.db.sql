
-- ============================================
-- ENUM TYPES
-- ============================================
CREATE TYPE user_role AS ENUM ('user', 'pharmacy', 'admin');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected', 'requires_resubmission');

-- ============================================
-- USER MANAGEMENT
-- Central authentication and authorization hub for everyone who enters the system
-- ============================================

CREATE TABLE users (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, -- professional standard for id pk's
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE,	-- phone police say numbers can't be more than 15 digits
    password_hash VARCHAR(255) NOT NULL, -- not null cause it's a password
    role user_role NOT NULL DEFAULT 'user', -- not null cause user needs a role
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP, -- nullable cause user might've sign up but never login
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete, nullable cuase we greedy
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL; -- users won't query deleted accounts

-- ============================================
-- USER PROFILES
-- stores extended user information not needed for authentication, but personalization
-- ============================================

CREATE TABLE user_profiles (
	id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	first_name VARCHAR(100),
	last_name VARCHAR(100),
	avatar_url TEXT, -- better than varchar for url's cause text can handle longer string
    date_of_birth DATE,
	gender gender_type,
    gender_custom VARCHAR(50),  -- Only populated when gender = 'other'
    weight DECIMAL(5,2), -- will store max (5 digits, 2 decimal) 999.99 (kg)? probably
    height DECIMAL(1,3), -- meters
    blood_type VARCHAR(5), -- A+, B-, O+ and what not | maybe change it to custom tyep enum later
    allergies TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_profiles_user_id ON user_profiles(user_id);


-- ============================================
-- KYC VERIFICATION
-- handles identity verification
-- ============================================

CREATE TABLE user_kyc (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	
	--	Actual User
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	
    -- Personal Identity Information
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender gender_type NOT NULL,
	
	-- Address Information
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
	
	-- Government ID Details
    id_type VARCHAR(50) NOT NULL, -- e.g., 'national_id', 'passport', 'drivers_license'
    id_number VARCHAR(100) NOT NULL,
	
	-- Cloud storage URL
    id_document_url TEXT,
    selfie_url TEXT,
	
	-- Verification Workflow
    status kyc_status DEFAULT 'pending',
    rejection_reason TEXT,
	
	-- Admin Verification Tracking
    verified_by BIGINT REFERENCES users(id),  -- Admin who approved/rejected
    verified_at TIMESTAMP,
	
	
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_kyc_user_id ON user_kyc(user_id);
CREATE INDEX idx_user_kyc_status ON user_kyc(status);