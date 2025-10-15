const buildDatabase = () => {

    return `
        -- PILLZA PostgreSQL Database Schema
        -- Designed for scalability (hundreds of thousands to millions of users)

        -- Enable UUID extension for better distributed ID generation
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geo-location features

        -- ============================================
        -- ENUM TYPES
        -- ============================================

        CREATE TYPE user_role AS ENUM ('user', 'pharmacy', 'admin');
        CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected', 'requires_resubmission');
        CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled');
        CREATE TYPE transaction_type AS ENUM ('earned', 'spent', 'refund', 'bonus', 'adjustment');
        CREATE TYPE reminder_frequency AS ENUM ('once', 'daily', 'weekly', 'monthly', 'custom');
        CREATE TYPE notification_type AS ENUM ('reminder', 'refill', 'order', 'reward', 'health_tip', 'system');

        -- ============================================
        -- USER MANAGEMENT
        -- ============================================

        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(20) UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role user_role NOT NULL DEFAULT 'user',
            is_active BOOLEAN DEFAULT true,
            is_verified BOOLEAN DEFAULT false,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP -- Soft delete
        );

        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_phone ON users(phone);
        CREATE INDEX idx_users_role ON users(role);
        CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

        -- ============================================
        -- KYC VERIFICATION
        -- ============================================

        CREATE TABLE user_kyc (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            full_name VARCHAR(255) NOT NULL,
            date_of_birth DATE NOT NULL,
            gender VARCHAR(20),
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(100),
            country VARCHAR(100),
            postal_code VARCHAR(20),
            id_type VARCHAR(50), -- e.g., 'national_id', 'passport', 'drivers_license'
            id_number VARCHAR(100),
            id_document_url TEXT, -- S3/Cloud storage URL
            selfie_url TEXT,
            status kyc_status DEFAULT 'pending',
            rejection_reason TEXT,
            verified_by UUID REFERENCES users(id),
            verified_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_user_kyc_user_id ON user_kyc(user_id);
        CREATE INDEX idx_user_kyc_status ON user_kyc(status);

        -- ============================================
        -- USER PROFILES
        -- ============================================

        CREATE TABLE user_profiles (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            avatar_url TEXT,
            date_of_birth DATE,
            gender VARCHAR(20),
            weight DECIMAL(5,2), -- in kg
            height DECIMAL(5,2), -- in cm
            blood_type VARCHAR(5),
            allergies TEXT[],
            emergency_contact_name VARCHAR(255),
            emergency_contact_phone VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

        -- ============================================
        -- PHARMACIES
        -- ============================================

        CREATE TABLE pharmacies (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            pharmacy_name VARCHAR(255) NOT NULL,
            license_number VARCHAR(100) UNIQUE NOT NULL,
            phone VARCHAR(20),
            email VARCHAR(255),
            address TEXT NOT NULL,
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            country VARCHAR(100) NOT NULL,
            postal_code VARCHAR(20),
            location GEOGRAPHY(POINT, 4326), -- PostGIS for geo-location
            opening_hours JSONB, -- Store as JSON: {"monday": "08:00-20:00", ...}
            is_24_hours BOOLEAN DEFAULT false,
            rating DECIMAL(3,2) DEFAULT 0.00,
            total_reviews INT DEFAULT 0,
            license_document_url TEXT,
            kyc_status kyc_status DEFAULT 'pending',
            verified_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_pharmacies_user_id ON pharmacies(user_id);
        CREATE INDEX idx_pharmacies_location ON pharmacies USING GIST(location);
        CREATE INDEX idx_pharmacies_kyc_status ON pharmacies(kyc_status);
        CREATE INDEX idx_pharmacies_city_state ON pharmacies(city, state);

        -- ============================================
        -- DRUGS / MEDICATIONS
        -- ============================================

        CREATE TABLE drugs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            generic_name VARCHAR(255),
            brand_name VARCHAR(255),
            manufacturer VARCHAR(255),
            drug_class VARCHAR(100),
            description TEXT,
            dosage_forms TEXT[], -- e.g., ['tablet', 'capsule', 'syrup']
            strengths TEXT[], -- e.g., ['10mg', '20mg']
            requires_prescription BOOLEAN DEFAULT false,
            side_effects TEXT[],
            contraindications TEXT[],
            image_url TEXT,
            barcode VARCHAR(100) UNIQUE,
            nafdac_number VARCHAR(100), -- Nigerian drug regulatory number
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_drugs_name ON drugs USING GIN(to_tsvector('english', name));
        CREATE INDEX idx_drugs_generic_name ON drugs USING GIN(to_tsvector('english', generic_name));
        CREATE INDEX idx_drugs_barcode ON drugs(barcode);
        CREATE INDEX idx_drugs_active ON drugs(is_active);

        -- ============================================
        -- PHARMACY INVENTORY
        -- ============================================

        CREATE TABLE pharmacy_inventory (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
            drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
            quantity INT NOT NULL DEFAULT 0,
            unit_price DECIMAL(10,2) NOT NULL,
            expiry_date DATE,
            batch_number VARCHAR(100),
            is_available BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(pharmacy_id, drug_id, batch_number)
        );

        CREATE INDEX idx_pharmacy_inventory_pharmacy_id ON pharmacy_inventory(pharmacy_id);
        CREATE INDEX idx_pharmacy_inventory_drug_id ON pharmacy_inventory(drug_id);
        CREATE INDEX idx_pharmacy_inventory_available ON pharmacy_inventory(is_available);
        CREATE INDEX idx_pharmacy_inventory_expiry ON pharmacy_inventory(expiry_date);

        -- ============================================
        -- MEDICATION REMINDERS
        -- ============================================

        CREATE TABLE medication_reminders (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
            medication_name VARCHAR(255) NOT NULL,
            dosage VARCHAR(100),
            frequency reminder_frequency NOT NULL,
            times_per_day INT,
            reminder_times TIME[], -- Array of times: ['08:00', '14:00', '20:00']
            start_date DATE NOT NULL,
            end_date DATE,
            notes TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_medication_reminders_user_id ON medication_reminders(user_id);
        CREATE INDEX idx_medication_reminders_active ON medication_reminders(is_active, start_date, end_date);

        -- ============================================
        -- REMINDER LOGS (Track if user took medication)
        -- ============================================

        CREATE TABLE reminder_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            reminder_id UUID NOT NULL REFERENCES medication_reminders(id) ON DELETE CASCADE,
            scheduled_time TIMESTAMP NOT NULL,
            taken_at TIMESTAMP,
            skipped BOOLEAN DEFAULT false,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_reminder_logs_reminder_id ON reminder_logs(reminder_id);
        CREATE INDEX idx_reminder_logs_scheduled_time ON reminder_logs(scheduled_time);
        -- Partition this table by month for better performance at scale
        -- ALTER TABLE reminder_logs PARTITION BY RANGE (scheduled_time);

        -- ============================================
        -- REFILL NOTIFICATIONS
        -- ============================================

        CREATE TABLE refill_notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reminder_id UUID REFERENCES medication_reminders(id) ON DELETE CASCADE,
            medication_name VARCHAR(255) NOT NULL,
            refill_date DATE NOT NULL,
            is_sent BOOLEAN DEFAULT false,
            sent_at TIMESTAMP,
            acknowledged BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_refill_notifications_user_id ON refill_notifications(user_id);
        CREATE INDEX idx_refill_notifications_refill_date ON refill_notifications(refill_date);

        -- ============================================
        -- ORDERS
        -- ============================================

        CREATE TABLE orders (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            order_number VARCHAR(50) UNIQUE NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
            status order_status DEFAULT 'pending',
            subtotal DECIMAL(10,2) NOT NULL,
            tokens_used DECIMAL(10,2) DEFAULT 0,
            discount DECIMAL(10,2) DEFAULT 0,
            total DECIMAL(10,2) NOT NULL,
            delivery_address TEXT,
            delivery_fee DECIMAL(10,2) DEFAULT 0,
            notes TEXT,
            prescription_url TEXT, -- If prescription required
            completed_at TIMESTAMP,
            cancelled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_orders_user_id ON orders(user_id);
        CREATE INDEX idx_orders_pharmacy_id ON orders(pharmacy_id);
        CREATE INDEX idx_orders_status ON orders(status);
        CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
        CREATE INDEX idx_orders_order_number ON orders(order_number);

        -- ============================================
        -- ORDER ITEMS
        -- ============================================

        CREATE TABLE order_items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            drug_id UUID NOT NULL REFERENCES drugs(id),
            inventory_id UUID REFERENCES pharmacy_inventory(id),
            drug_name VARCHAR(255) NOT NULL,
            quantity INT NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_order_items_order_id ON order_items(order_id);
        CREATE INDEX idx_order_items_drug_id ON order_items(drug_id);

        -- ============================================
        -- REWARDS & TOKENS
        -- ============================================

        CREATE TABLE user_wallets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            balance DECIMAL(10,2) DEFAULT 0.00,
            lifetime_earned DECIMAL(10,2) DEFAULT 0.00,
            lifetime_spent DECIMAL(10,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_user_wallets_user_id ON user_wallets(user_id);

        -- ============================================
        -- WALLET TRANSACTIONS
        -- ============================================

        CREATE TABLE wallet_transactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type transaction_type NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            balance_before DECIMAL(10,2) NOT NULL,
            balance_after DECIMAL(10,2) NOT NULL,
            description TEXT,
            reference_type VARCHAR(50), -- e.g., 'order', 'activity', 'bonus'
            reference_id UUID, -- Related order_id, activity_id, etc.
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
        CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
        CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
        -- Partition this table by month for better performance at scale
        -- ALTER TABLE wallet_transactions PARTITION BY RANGE (created_at);

        -- ============================================
        -- USER ACTIVITIES (Steps, Calories)
        -- ============================================

        CREATE TABLE user_activities (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            activity_date DATE NOT NULL,
            steps INT DEFAULT 0,
            calories_burned DECIMAL(8,2) DEFAULT 0.00,
            distance_km DECIMAL(8,2) DEFAULT 0.00,
            active_minutes INT DEFAULT 0,
            tokens_earned DECIMAL(10,2) DEFAULT 0.00,
            synced_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, activity_date)
        );

        CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
        CREATE INDEX idx_user_activities_date ON user_activities(activity_date DESC);
        -- Partition this table by month for better performance at scale
        -- ALTER TABLE user_activities PARTITION BY RANGE (activity_date);

        -- ============================================
        -- HEALTH VITALS
        -- ============================================

        CREATE TABLE health_vitals (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recorded_at TIMESTAMP NOT NULL,
            blood_pressure_systolic INT,
            blood_pressure_diastolic INT,
            heart_rate INT,
            blood_sugar DECIMAL(5,2),
            temperature DECIMAL(4,2),
            weight DECIMAL(5,2),
            bmi DECIMAL(4,2),
            oxygen_saturation INT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_health_vitals_user_id ON health_vitals(user_id);
        CREATE INDEX idx_health_vitals_recorded_at ON health_vitals(recorded_at DESC);

        -- ============================================
        -- AI HEALTH TIPS
        -- ============================================

        CREATE TABLE health_tips (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            category VARCHAR(100), -- e.g., 'nutrition', 'exercise', 'medication', 'mental_health'
            tags TEXT[],
            image_url TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_health_tips_category ON health_tips(category);
        CREATE INDEX idx_health_tips_active ON health_tips(is_active);

        -- ============================================
        -- USER HEALTH TIPS (Personalized recommendations)
        -- ============================================

        CREATE TABLE user_health_tips (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            tip_id UUID NOT NULL REFERENCES health_tips(id) ON DELETE CASCADE,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMP,
            helpful BOOLEAN,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_user_health_tips_user_id ON user_health_tips(user_id);
        CREATE INDEX idx_user_health_tips_sent_at ON user_health_tips(sent_at DESC);

        -- ============================================
        -- NOTIFICATIONS
        -- ============================================

        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type notification_type NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            reference_type VARCHAR(50), -- e.g., 'order', 'reminder', 'reward'
            reference_id UUID,
            is_read BOOLEAN DEFAULT false,
            read_at TIMESTAMP,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX idx_notifications_read ON notifications(is_read);
        CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);

        -- ============================================
        -- PHARMACY REVIEWS
        -- ============================================

        CREATE TABLE pharmacy_reviews (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
            rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(pharmacy_id, user_id, order_id)
        );

        CREATE INDEX idx_pharmacy_reviews_pharmacy_id ON pharmacy_reviews(pharmacy_id);
        CREATE INDEX idx_pharmacy_reviews_user_id ON pharmacy_reviews(user_id);

        -- ============================================
        -- ADMIN ACTIVITY LOGS
        -- ============================================

        CREATE TABLE admin_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            action VARCHAR(100) NOT NULL, -- e.g., 'user_verified', 'pharmacy_approved', 'drug_added'
            entity_type VARCHAR(50), -- e.g., 'user', 'pharmacy', 'drug'
            entity_id UUID,
            details JSONB, -- Store additional context
            ip_address INET,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
        CREATE INDEX idx_admin_logs_action ON admin_logs(action);
        CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

        -- ============================================
        -- SYSTEM SETTINGS
        -- ============================================

        CREATE TABLE system_settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT NOT NULL,
            description TEXT,
            updated_by UUID REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- ============================================
        -- FUNCTIONS & TRIGGERS
        -- ============================================

        -- Function to update updated_at timestamp
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        -- Apply trigger to all tables with updated_at
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_user_kyc_updated_at BEFORE UPDATE ON user_kyc FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_pharmacies_updated_at BEFORE UPDATE ON pharmacies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON drugs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_pharmacy_inventory_updated_at BEFORE UPDATE ON pharmacy_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_medication_reminders_updated_at BEFORE UPDATE ON medication_reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_user_wallets_updated_at BEFORE UPDATE ON user_wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_user_activities_updated_at BEFORE UPDATE ON user_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_health_tips_updated_at BEFORE UPDATE ON health_tips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_pharmacy_reviews_updated_at BEFORE UPDATE ON pharmacy_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        -- ============================================
        -- VIEWS FOR DASHBOARDS
        -- ============================================

        -- User Dashboard Summary View
        CREATE OR REPLACE VIEW user_dashboard_summary AS
        SELECT 
            u.id as user_id,
            up.first_name,
            up.last_name,
            uw.balance as token_balance,
            uw.lifetime_earned,
            COUNT(DISTINCT mr.id) as active_reminders,
            COUNT(DISTINCT o.id) as total_orders,
            COALESCE(SUM(ua.steps), 0) as total_steps_this_month
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN user_wallets uw ON u.id = uw.user_id
        LEFT JOIN medication_reminders mr ON u.id = mr.user_id AND mr.is_active = true
        LEFT JOIN orders o ON u.id = o.user_id
        LEFT JOIN user_activities ua ON u.id = ua.user_id 
            AND ua.activity_date >= DATE_TRUNC('month', CURRENT_DATE)
        WHERE u.role = 'user' AND u.deleted_at IS NULL
        GROUP BY u.id, up.first_name, up.last_name, uw.balance, uw.lifetime_earned;

        -- Pharmacy Dashboard Summary View
        CREATE OR REPLACE VIEW pharmacy_dashboard_summary AS
        SELECT 
            p.id as pharmacy_id,
            p.pharmacy_name,
            p.rating,
            COUNT(DISTINCT pi.id) as total_drugs,
            COUNT(DISTINCT o.id) as total_orders,
            COALESCE(SUM(o.total), 0) as total_revenue,
            COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders
        FROM pharmacies p
        LEFT JOIN pharmacy_inventory pi ON p.id = pi.pharmacy_id AND pi.is_available = true
        LEFT JOIN orders o ON p.id = o.pharmacy_id
        WHERE p.kyc_status = 'approved'
        GROUP BY p.id, p.pharmacy_name, p.rating;

        -- Admin Analytics View
        CREATE OR REPLACE VIEW admin_analytics AS
        SELECT 
            COUNT(DISTINCT CASE WHEN u.role = 'user' THEN u.id END) as total_users,
            COUNT(DISTINCT CASE WHEN u.role = 'pharmacy' THEN u.id END) as total_pharmacies,
            COUNT(DISTINCT d.id) as total_drugs,
            COUNT(DISTINCT o.id) as total_orders,
            COALESCE(SUM(o.total), 0) as total_revenue,
            COUNT(DISTINCT CASE WHEN uk.status = 'pending' THEN uk.id END) as pending_kyc_verifications
        FROM users u
        LEFT JOIN drugs d ON d.is_active = true
        LEFT JOIN orders o ON true
        LEFT JOIN user_kyc uk ON true;`;

};

export default buildDatabase;