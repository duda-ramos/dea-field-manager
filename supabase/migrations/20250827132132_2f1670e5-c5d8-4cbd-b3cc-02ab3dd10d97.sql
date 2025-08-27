-- Reset user password if there's an issue
UPDATE auth.users 
SET encrypted_password = crypt('DuDa2707*', gen_salt('bf'))
WHERE email = 'mariaeduarda@deadesign.com.br';