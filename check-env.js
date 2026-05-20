// 环境变量诊断脚本
console.log('=== 环境变量检查 ===\n');

const vars = [
  'COZE_SUPABASE_URL',
  'COZE_SUPABASE_ANON_KEY', 
  'COZE_SUPABASE_SERVICE_ROLE_KEY',  // 代码需要这个
  'COZE_SUPABASE_SERVICE_KEY',       // 你配置的是这个
  'NEXT_PUBLIC_COZE_SUPABASE_URL',
  'NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY'
];

vars.forEach(name => {
  const value = process.env[name];
  if (value) {
    // 只显示前20个字符，保护密钥安全
    const display = value.length > 20 ? value.substring(0, 20) + '...' : value;
    console.log(`✅ ${name}: ${display}`);
  } else {
    console.log(`❌ ${name}: 未设置`);
  }
});

console.log('\n=== 关键检查 ===');
if (process.env.COZE_SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✅ Service Role Key 已正确配置');
} else if (process.env.COZE_SUPABASE_SERVICE_KEY) {
  console.log('⚠️  注意：你设置了 COZE_SUPABASE_SERVICE_KEY，但代码需要 COZE_SUPABASE_SERVICE_ROLE_KEY');
  console.log('   请添加一行：COZE_SUPABASE_SERVICE_ROLE_KEY=sb_secret_...');
} else {
  console.log('❌ Service Role Key 未设置');
}
