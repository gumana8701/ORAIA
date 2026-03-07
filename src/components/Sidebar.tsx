import Image from 'next/image';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="logo">
        <Image src="/logo.png" alt="Logo" width={100} height={100} layout="responsive" />
      </div>
      {/* Original sidebar code here */}
    </div>
  );
};

export default Sidebar;