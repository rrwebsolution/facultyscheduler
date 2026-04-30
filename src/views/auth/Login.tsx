// src/components/Login.tsx

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import React, { useState } from 'react';
import { Facebook, Instagram, Lock, LogInIcon, Mail, Twitter, Eye, EyeOff } from 'lucide-react';
import axios from '../../plugin/axios';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const isFirstTime = !localStorage.getItem('alreadyLoggedIn');
    localStorage.setItem('alreadyLoggedIn', 'true');

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();

        const newErrors: typeof errors = {};

        if (!email.trim()) newErrors.email = 'Email is required';
        if (!password.trim()) newErrors.password = 'Password is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('login', {
                email,
                password
            });

            const { data } = response;

            // Login successful
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            toast.success('Login successful 🎉', {
                description: isFirstTime
                    ? `Welcome, ${data.user.name}!`
                    : `Welcome back, ${data.user.name}!`,
            });

            setErrors({});

            // Role-based redirection
            switch(data.user.role) {
                case 0:
                    navigate('/admin/user-dashboard', { replace: true });
                    break;
                case 1:
                    navigate('/dean/user-dashboard', { replace: true });
                    break;
                case 2:
                    navigate('/faculty/user-dashboard', { replace: true });
                    break;
                default:
                    navigate('/admin/user-dashboard', { replace: true });
            }
        } catch (error: unknown) {
            console.error('Login error:', error);
            if (isAxiosError(error)) {
                const errorMessage = error.response?.data?.message;
                if (error.response?.status === 401) {
                    toast.error(errorMessage || 'Invalid credentials 😓');
                    setErrors(prevErrors => ({
                        ...prevErrors,[errorMessage?.toLowerCase().includes('email') ? 'email' : 'password']: errorMessage
                    }));
                } else {
                    toast.error('Login failed. Please try again later 😓');
                }
            } else {
                toast.error('Network error. Please check your connection 😓');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] px-4 overflow-hidden">
            {/* Immersive Background Blur Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/20 rounded-[100%] blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-fuchsia-600/10 rounded-[100%] blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-[420px] z-10"
            >
                <Card className="relative w-full rounded-[2rem] bg-white/[0.03] border border-white/[0.08] shadow-2xl backdrop-blur-2xl overflow-hidden p-6 sm:p-8">
                    {/* Subtle top glare effect */}
                    <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    <CardHeader className="flex flex-col items-center space-y-4 text-white p-0 mb-8">
                        <motion.div
                            whileHover={{ scale: 1.05, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 300 }}
                            className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-violet-600 to-fuchsia-500 rounded-2xl shadow-[0_0_40px_rgba(139,92,246,0.4)]"
                        >
                            <span className="text-4xl font-black text-white tracking-tighter">FS</span>
                        </motion.div>
                        <div className="text-center space-y-1">
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
                            <p className="text-sm font-medium text-white/50">Enter your credentials to continue</p>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <form className="space-y-5" onSubmit={handleLogin}>
                            
                            {/* --- EMAIL FIELD --- */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-white/70 ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute top-1/2 left-4 transform -translate-y-1/2 text-fuchsia-400 group-focus-within:text-fuchsia-400 transition-colors" size={20} />
                                    <Input
                                        type="email"
                                        value={email}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setEmail(value);
                                            setErrors(prev => ({ ...prev, email: value.trim() ? undefined : 'Email is required' }));
                                        }}
                                        placeholder="juandelacruz@example.com"
                                        className={`pl-11 h-14 text-base rounded-xl bg-black/20 border-white/10 text-white placeholder:text-white/20 hover:bg-black/30 focus:bg-black/40 focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-all duration-300 ${errors.email ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/50' : ''}`}
                                    />
                                </div>
                                {errors.email && (
                                    <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-[13px] font-medium text-red-400 ml-1 block">
                                        {errors.email}
                                    </motion.span>
                                )}
                            </div>

                            {/* --- PASSWORD FIELD --- */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-white/70 ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute top-1/2 left-4 transform -translate-y-1/2 text-fuchsia-400 group-focus-within:text-fuchsia-400 transition-colors" size={20} />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setPassword(value);
                                            setErrors(prev => ({ ...prev, password: value.trim() ? undefined : 'Password is required' }));
                                        }}
                                        placeholder="Enter your password"
                                        className={`pl-11 pr-12 h-14 text-base rounded-xl bg-black/20 border-white/10 text-white placeholder:text-white/20 hover:bg-black/30 focus:bg-black/40 focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-all duration-300 ${errors.password ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/50' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        className="absolute top-1/2 right-4 transform -translate-y-1/2 text-white/40 hover:text-white transition-colors duration-300 outline-none"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-[13px] font-medium text-red-400 ml-1 block">
                                        {errors.password}
                                    </motion.span>
                                )}
                            </div>

                            {/* --- LOGIN BUTTON --- */}
                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    className="w-full h-14 text-[15px] font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl shadow-[0_4px_14px_0_rgba(168,85,247,0.39)] hover:shadow-[0_6px_20px_rgba(168,85,247,0.23)] border-0 transform transition-all duration-300"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-5 h-5" />
                                            <span>Authenticating...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center space-x-2">
                                            <span>Secure Login</span>
                                            <LogInIcon size={18} />
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>

            {/* --- FOOTER --- */}
            <div className="mt-10 flex flex-col items-center z-10 space-y-6">
                <div className="flex items-center space-x-4">
                    {[
                        { icon: <Facebook size={18} className="text-white" />, href: '#' },
                        { icon: <Instagram size={18} className="text-white" />, href: '#' },
                        { icon: <Twitter size={18} className="text-white" />, href: '#' },
                    ].map(({ icon, href }, index) => (
                        <motion.a
                            key={index}
                            href={href}
                            whileHover={{ scale: 1.1, y: -2 }}
                            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            {icon}
                        </motion.a>
                    ))}
                </div>
                <p className="text-xs font-medium text-white/40 tracking-wider uppercase">
                    Developed by: RR Web Solution
                </p>
            </div>
        </div>
    );
};

export default Login;
