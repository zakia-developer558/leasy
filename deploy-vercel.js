#!/usr/bin/env node

/**
 * Vercel Deployment Helper Script
 * 
 * This script helps with deploying the application to Vercel
 * It performs basic checks and provides guidance
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\x1b[36m%s\x1b[0m', '🚀 Vercel Deployment Helper');
console.log('----------------------------');

// Check if vercel is installed
try {
  execSync('vercel --version', { stdio: 'ignore' });
} catch (error) {
  console.log('\x1b[31m%s\x1b[0m', '❌ Vercel CLI not found');
  console.log('Please install Vercel CLI:');
  console.log('\x1b[33m%s\x1b[0m', 'npm install -g vercel');
  process.exit(1);
}

// Check if vercel.json exists
if (!fs.existsSync('./vercel.json')) {
  console.log('\x1b[31m%s\x1b[0m', '❌ vercel.json not found');
  process.exit(1);
}

// Check if .env.example exists
if (!fs.existsSync('./.env.example')) {
  console.log('\x1b[33m%s\x1b[0m', '⚠️ .env.example not found');
  console.log('Make sure all environment variables are set in Vercel dashboard');
}

// Ask for environment
rl.question('\x1b[36m%s\x1b[0m', 'Deploy to production? (y/n): ', (answer) => {
  const isProd = answer.toLowerCase() === 'y';
  
  console.log('\x1b[36m%s\x1b[0m', '----------------------------');
  console.log('Environment Variables Reminder:');
  console.log('- MONGO_URI');
  console.log('- JWT_SECRET');
  console.log('- SENDGRID_API_KEY');
  console.log('- SENDGRID_FROM_EMAIL');
  console.log('- FRONTEND_URL');
  console.log('- ONFIDO_API_TOKEN');
  console.log('- ONFIDO_WEBHOOK_SECRET');
  console.log('\x1b[36m%s\x1b[0m', '----------------------------');
  
  console.log(`Deploying to ${isProd ? 'production' : 'preview'}...`);
  
  try {
    const command = isProd ? 'vercel --prod' : 'vercel';
    const output = execSync(command, { stdio: 'inherit' });
    console.log('\x1b[32m%s\x1b[0m', '✅ Deployment initiated');
  } catch (error) {
    console.log('\x1b[31m%s\x1b[0m', '❌ Deployment failed');
    console.error(error);
  }
  
  rl.close();
}); 