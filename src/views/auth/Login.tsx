// src/components/Login.tsx

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import React, { useState } from 'react';
import { Facebook, Instagram, Lock, LogInIcon, Mail, Twitter, Eye, EyeOff } from 'lucide-react';
import axios from '../../plugin/axios';
import { isAxiosError } from 'axios';
import { Link, useNavigate } from 'react-router-dom';
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

            console.log('Login successful:', data);
            toast.success('Login successful 🎉', {
                description: isFirstTime
                    ? `Welcome, ${data.user.name}!`
                    : `Welcome back, ${data.user.name}!`,
            });

            setErrors({});

            // Role-based redirection
                switch(data.user.role) {
                    case 0:
                        navigate('/admin/user-dashboard');
                        break;
                    case 1:
                        navigate('/dean/user-dashboard');
                        break;
                    case 2:
                        navigate('/faculty/user-dashboard');
                        break;
                    default:
                        navigate('/admin/user-dashboard');
                }
        } catch (error: unknown) {
            console.error('Login error:', error);
            if (isAxiosError(error)) {
                const errorMessage = error.response?.data?.message;
                if (error.response?.status === 401) {
                    toast.error(errorMessage || 'Invalid credentials 😓');
                    setErrors(prevErrors => ({
                        ...prevErrors,
                        [errorMessage?.toLowerCase().includes('email') ? 'email' : 'password']: errorMessage
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
        <div className="flex flex-col md:p-10 items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4">
            <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <Card className="relative w-full p-8 md:p-2 rounded-3xl bg-white/10 border border-white/20 shadow-2xl backdrop-blur-lg">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 opacity-50 animate-pulse pointer-events-none"></div>
                    <CardHeader className="flex flex-col items-center space-y-3 text-white z-10">
                        <motion.div
                            whileHover={{ scale: 1.1, rotate: 10 }}
                            className="relative flex items-center justify-center w-24 h-24 bg-gradient-to-tr from-violet-700 to-fuchsia-500 rounded-full shadow-xl"
                        >
                            <div className="absolute inset-0 animate-ping rounded-full bg-gradient-to-tr from-violet-700 to-fuchsia-500 opacity-50 blur-md"></div>
                            <span className="relative text-5xl font-bold text-white">FS</span>
                        </motion.div>
                        <h2 className="text-4xl md:text-xl font-extrabold">Welcome Back</h2>
                        <p className="text-md text-purple-200">Sign in to continue</p>
                    </CardHeader>

                    <CardContent className="z-10">
                        <form className="space-y-8" onSubmit={handleLogin}>
                            <div className="relative">
                                <Mail className="absolute top-7 left-3 transform -translate-y-1/2 text-purple-400" size={22} />
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setEmail(value);
                                        setErrors(prev => ({ ...prev, email: value.trim() ? undefined : 'Email is required' }));
                                    }}
                                    placeholder="Enter your email"
                                    className={`pl-12 py-3 h-14 text-base rounded-lg bg-white shadow-inner focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 text-black placeholder-white transition-all duration-300 ${errors.email ? 'border-red-500' : 'border-white/30'
                                        }`}
                                />
                                {errors.email && (
                                    <span className="text-sm text-red-400 mt-2 block">{errors.email}</span>
                                )}
                            </div>

                            <div className="relative">
                                <Lock className="absolute top-7 left-3 transform -translate-y-1/2 text-purple-400" size={22} />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setPassword(value);
                                        setErrors(prev => ({ ...prev, password: value.trim() ? undefined : 'Password is required' }));
                                    }}
                                    placeholder="Enter your password"
                                    className={`pl-12 pr-12 py-3 h-14 text-base rounded-lg bg-white shadow-inner focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 text-black placeholder-gray-400 transition-all duration-300 ${errors.password ? 'border-red-500' : 'border-white/30'
                                        }`}
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    className="absolute top-7 right-3 transform -translate-y-1/2 text-purple-400 hover:text-fuchsia-400 focus:outline-none transition-colors duration-300"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                </button>
                                {errors.password && (
                                    <span className="text-sm text-red-400 mt-2 block">{errors.password}</span>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full py-4 text-lg font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center">
                                        <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5 mr-3" />
                                        <span>Logging in...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-2">
                                        <LogInIcon />
                                        <span>Login</span>
                                    </div>
                                )}
                            </Button>
                        </form>
                        <div className="flex justify-end mt-2 z-10">
                            <Link
                                to="/forgot-password"
                                className="text-sm text-purple-300 hover:underline hover:text-fuchsia-300 transition-colors duration-300 cursor-pointer font-semibold"
                            >
                                Forgot password?
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <p className="mt-8 text-md text-white/70">Developed by: RR Web Solution</p>

            <div className="flex space-x-6 mt-6">
                {[
                    { icon: <Facebook size={24} className="text-white" />, href: '#' },
                    { icon: <Instagram size={24} className="text-white" />, href: '#' },
                    { icon: <Twitter size={24} className="text-white" />, href: '#' },
                ].map(({ icon, href }, index) => (
                    <motion.a
                        key={index}
                        href={href}
                        whileHover={{ scale: 1.2, y: -5 }}
                        className="p-3 rounded-full bg-white/20 backdrop-blur-md hover:bg-fuchsia-500/70 transition-all shadow-lg"
                    >
                        {icon}
                    </motion.a>
                ))}
            </div>
        </div>
    );
};

export default Login;
