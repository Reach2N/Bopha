import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Bopha</h1>
        <p className="text-gray-600 mb-8">Your AI-powered voice assistant platform</p>
        <div className="space-y-4">
          <a 
            href="/v2v" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Voice Agent
          </a>
          <br />
          <a 
            href="/t2v" 
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Podcast Generator
          </a>
        </div>
      </div>
    </div>
  );
}
