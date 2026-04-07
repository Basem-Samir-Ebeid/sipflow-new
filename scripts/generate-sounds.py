import struct
import wave
import math
import os

def generate_tone(filename, frequency, duration, volume=0.5):
    """Generate a simple tone and save as WAV file"""
    sample_rate = 44100
    num_samples = int(sample_rate * duration)
    
    # Generate samples
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        # Add fade in/out to avoid clicks
        fade_samples = int(sample_rate * 0.05)
        if i < fade_samples:
            fade = i / fade_samples
        elif i > num_samples - fade_samples:
            fade = (num_samples - i) / fade_samples
        else:
            fade = 1.0
        
        sample = volume * fade * math.sin(2 * math.pi * frequency * t)
        samples.append(int(sample * 32767))
    
    # Write WAV file
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for sample in samples:
            wav_file.writeframes(struct.pack('<h', sample))

def generate_notification_sound(filename):
    """Generate a pleasant notification sound (two tones)"""
    sample_rate = 44100
    duration = 0.3
    
    samples = []
    
    # First tone (higher)
    for i in range(int(sample_rate * duration / 2)):
        t = i / sample_rate
        fade = min(i / 1000, 1.0, (sample_rate * duration / 2 - i) / 1000)
        sample = 0.4 * fade * math.sin(2 * math.pi * 880 * t)
        samples.append(int(sample * 32767))
    
    # Second tone (even higher)
    for i in range(int(sample_rate * duration / 2)):
        t = i / sample_rate
        fade = min(i / 1000, 1.0, (sample_rate * duration / 2 - i) / 1000)
        sample = 0.4 * fade * math.sin(2 * math.pi * 1047 * t)
        samples.append(int(sample * 32767))
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for sample in samples:
            wav_file.writeframes(struct.pack('<h', sample))

def generate_order_sound(filename):
    """Generate an attention-grabbing order sound (three ascending tones)"""
    sample_rate = 44100
    tone_duration = 0.15
    
    samples = []
    frequencies = [523, 659, 784]  # C5, E5, G5 - major chord ascending
    
    for freq in frequencies:
        for i in range(int(sample_rate * tone_duration)):
            t = i / sample_rate
            fade = min(i / 500, 1.0, (sample_rate * tone_duration - i) / 500)
            sample = 0.5 * fade * math.sin(2 * math.pi * freq * t)
            samples.append(int(sample * 32767))
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for sample in samples:
            wav_file.writeframes(struct.pack('<h', sample))

# Create sounds directory
os.makedirs('public/sounds', exist_ok=True)

# Generate sounds as WAV (browsers can play WAV files)
generate_notification_sound('public/sounds/notification.wav')
generate_order_sound('public/sounds/order.wav')

print("Sound files generated successfully!")
print("- public/sounds/notification.wav")
print("- public/sounds/order.wav")
