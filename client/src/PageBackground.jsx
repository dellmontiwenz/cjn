const backgroundPhotos = [
  '/backgrounds/photo-1.png',
  '/backgrounds/photo-2.png',
  '/backgrounds/photo-3.png',
  '/backgrounds/photo-4.png',
  '/backgrounds/photo-5.png',
  '/backgrounds/photo-6.png',
  '/backgrounds/photo-7.png',
];

export default function PageBackground() {
  return (
    <div className="page-photo-bg" aria-hidden="true">
      {backgroundPhotos.map((photo) => (
        <span key={photo} style={{ backgroundImage: `url(${photo})` }} />
      ))}
    </div>
  );
}
