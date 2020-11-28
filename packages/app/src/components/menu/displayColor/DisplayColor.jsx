import React, { useState, useEffect, useRef } from 'react';

import ColorerThumbnail from './colorerThumbnail/ColorerThumbnail.jsx';

import './DisplayColor.scss';

const DisplayColor = ({ colorers, viewer, showDisplayColor }) => {
  const ref = useRef();
  const { colorer } = viewer.rep(viewer.repCurrent());
  const [currentColorer, setCurrentColorer] = useState(colorer);
  const colorerInstances = colorers.all.map((E) => new E());

  const colorerThumbnails = colorerInstances.map(({ shortName, id }, index) => (
    <ColorerThumbnail
      shortName={shortName}
      id={id}
      key={index}
      selected={currentColorer === id}
      onClick={() => {
        viewer.rep({ colorer: id });
        setCurrentColorer(id);
        // showDisplayColor();
      }}
    />
  ));

  const handleClickOutside = ({ target }) => {
    if (!ref.current.contains(target)) {
      showDisplayColor();
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="display-color" ref={ref}>
      <strong>Display color</strong>
      <div className="colorer-thumbnail-group">{colorerThumbnails}</div>
    </div>
  );
};

export default DisplayColor;