import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from '../../../../plugin/axios';

function SettingsPage() {
  const baseUrl = (import.meta.env.VITE_URL || '').replace(/\/$/, '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await axios.get('/user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = res.data || {};
        setName(user.name || '');
        setEmail(user.email || '');
        setPhone(user.phone || '');
        setLocation(user.location || '');
        setAvatar(user.profile_picture || '');
      } catch (error) {
        toast.error('Failed to load account settings.');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleSaveProfile = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      toast.error('Authentication required.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await axios.put(
        '/profile',
        {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          location: location.trim() || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedUser = res.data?.user;
      if (updatedUser) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      toast.success(res.data?.message || 'Profile updated successfully.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const getAvatarSrc = () => {
    if (avatar && avatar.startsWith('http')) return avatar;
    if (avatar) return `${baseUrl}/${avatar}`;
    return `https://i.pravatar.cc/150?u=${email || 'user@example.com'}`;
  };

  const uploadAvatar = async (file: File) => {
    if (!file) {
      toast.error('Please choose an image first.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      toast.error('Authentication required.');
      return;
    }

    setIsSavingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await axios.post('/profile/avatar', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const updatedUser = res.data?.user;
      if (updatedUser) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setAvatar(updatedUser.profile_picture || '');
      }
      toast.success(res.data?.message || 'Profile picture updated successfully.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update profile picture.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    // Show preview instantly while upload is in progress.
    const previewUrl = URL.createObjectURL(file);
    setAvatar(previewUrl);

    await uploadAvatar(file);
    URL.revokeObjectURL(previewUrl);
  };

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      toast.error('Authentication required.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await axios.put(
        '/profile/password',
        {
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data?.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account settings and credentials.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80">
        <div className="p-6 border-b border-slate-200/80">
          <h2 className="text-xl font-bold text-slate-800">Profile Information</h2>
          <p className="text-sm text-slate-500 mt-1">Update your account name and email.</p>
        </div>
        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="h-24 flex items-center justify-center text-slate-500">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading profile...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <img src={getAvatarSrc()} alt="Profile" className="w-20 h-20 rounded-full object-cover border border-slate-200" />
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={handleAvatarChange} />
                  {isSavingAvatar && (
                    <p className="text-xs text-slate-500 inline-flex items-center">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Uploading image...
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                  placeholder="Enter location"
                />
              </div>
            </>
          )}
        </div>
        <div className="bg-slate-50/50 p-4 border-t border-slate-200/80 text-right rounded-b-2xl">
          <button
            onClick={handleSaveProfile}
            disabled={isLoading || isSavingProfile}
            className="px-5 py-2.5 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isSavingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSavingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80">
        <div className="p-6 border-b border-slate-200/80">
          <h2 className="text-xl font-bold text-slate-800">Security</h2>
          <p className="text-sm text-slate-500 mt-1">Change your password to keep your account secure.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="Current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="New password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
        <div className="bg-slate-50/50 p-4 border-t border-slate-200/80 text-right rounded-b-2xl">
          <button
            onClick={handleSavePassword}
            disabled={isSavingPassword}
            className="px-5 py-2.5 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isSavingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSavingPassword ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
