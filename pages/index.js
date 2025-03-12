import React from 'react';
import Quiz from '../components/Quiz';

const Home = () => {
  return (
    <div>
      <Quiz />
      <div className="version-tag">Version 3.23</div>
    </div>
  );
};

export default Home;