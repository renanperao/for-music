import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import ProfileForm from './profile-form';

export default async function ProfilePage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Meu Perfil</h1>
      <ProfileForm profile={profile} />
    </div>
  );
}
