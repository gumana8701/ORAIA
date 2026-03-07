import Image from 'next/image';

function Sidebar() {
  return (
    <div>
      <Image 
        src="/public/logo.png" 
        alt="Logo" 
        style={{ width: '100%', height: 'auto', maxWidth: '100px', maxHeight: '100px', objectFit: 'contain' }} 
      />
      <h1>ORA IA</h1>
      <h2>Your subtitle here</h2>
    </div>
  );
}

export default Sidebar;