const { Client } = require('pg');

const connectionString = 'postgresql://postgres1:GFl7Bffoe49eWZSNIh67801iCt8G4CkN@dpg-d58t8lu3jp1c73bnl7tg-a.singapore-postgres.render.com/chat_user_service';

async function deleteUser() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database!');

    const targetEmail = 'tam2@gmail.com';

    // BƯỚC 1: Kiểm tra user tồn tại
    console.log('\n=== BƯỚC 1: Kiểm tra user ===');
    const userResult = await client.query(
      'SELECT user_id, username, email, created_at FROM "users" WHERE email = $1',
      [targetEmail]
    );

    if (userResult.rows.length === 0) {
      console.log(`Không tìm thấy user với email: ${targetEmail}`);
      return;
    }

    const user = userResult.rows[0];
    console.log('Tìm thấy user:', user);

    // BƯỚC 2: Kiểm tra các bảng liên quan
    console.log('\n=== BƯỚC 2: Kiểm tra data liên quan ===');

    const rolesResult = await client.query(
      'SELECT * FROM "user_role" WHERE user_id = $1',
      [user.user_id]
    );
    console.log(`User có ${rolesResult.rows.length} role(s):`, rolesResult.rows);

    const tokensResult = await client.query(
      'SELECT token_id, expired_at FROM "tokens" WHERE user_id = $1',
      [user.user_id]
    );
    console.log(`User có ${tokensResult.rows.length} token(s)`);

    // BƯỚC 3: Xóa user_role
    console.log('\n=== BƯỚC 3: Xóa user_role ===');
    const deleteRolesResult = await client.query(
      'DELETE FROM "user_role" WHERE user_id = $1',
      [user.user_id]
    );
    console.log(`Đã xóa ${deleteRolesResult.rowCount} role(s)`);

    // BƯỚC 4: Xóa tokens
    console.log('\n=== BƯỚC 4: Xóa tokens ===');
    const deleteTokensResult = await client.query(
      'DELETE FROM "tokens" WHERE user_id = $1',
      [user.user_id]
    );
    console.log(`Đã xóa ${deleteTokensResult.rowCount} token(s)`);

    // BƯỚC 5: Xóa user
    console.log('\n=== BƯỚC 5: Xóa user ===');
    const deleteUserResult = await client.query(
      'DELETE FROM "users" WHERE user_id = $1',
      [user.user_id]
    );
    console.log(`Đã xóa user: ${user.username} (${user.email})`);

    // Verify
    console.log('\n=== VERIFY: Kiểm tra lại ===');
    const verifyResult = await client.query(
      'SELECT * FROM "users" WHERE email = $1',
      [targetEmail]
    );
    if (verifyResult.rows.length === 0) {
      console.log('✅ User đã được xóa thành công!');
    } else {
      console.log('❌ User vẫn tồn tại!');
    }

  } catch (err) {
    console.error('Lỗi:', err);
  } finally {
    await client.end();
    console.log('\nĐã ngắt kết nối database.');
  }
}

deleteUser();
