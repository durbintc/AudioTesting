To utilize Spotify mode (On Windows), you must use software like VB Audio Cable so your device uses the audio output as a microphone input, which is then used as input for the music visualizer. Here's a quick demo on how to get this prepared.

1: Go to https://vb-audio.com/Cable/ and download the latest version
2: Extract the ZIP file
3: Right-click VBCABLE_Setup_x64.exe (or x86) and "Run as Administrator"
4: Click "Install Driver"
5: Restart your device

Now, when you go to your audio settings, you should see CABLE Input (VB-Audio Virtual Cable) (or CABLE Output). 

1: Select them for both input and output.
2: When the program is open, select CABLE Input as the microphone option

Now it will be listening to the Spotify output. To also hear the music come from your speakers as well:

1: Press Windows+r
2: Type in mmsys.cpl to bring up audio settings
3: Go to Recording
4: Right-click CABLE Output (VB-Audio Virtual Cable) and Select Properties
5: Go to Listen
6: Check "Listen to this device"
7: Click the dropdown menu and select your desired output device (Don't use Default Playback Device. Since your default is VB-Audio, nothing will play. So select your device speakers, connected headphones, etc.)
7.5: To adjust the volume, you will need to change your audio output to your speaker, change the volume, then switch back to VB-Audio. I recommend setting it higher, then adjusting the volume coming from Spotify instead
