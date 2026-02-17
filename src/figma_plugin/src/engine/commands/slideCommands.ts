import { getAbsoluteGeometry, distillNodeInfo } from '../utils';

export async function createSlide(params: {
  name?: string;
  row?: number;
  column?: number;
}) {
  const { name, row, column } = params ?? {};

  let slide: SceneNode;
  if (typeof (figma as any).createSlide === 'function') {
    slide = (figma as any).createSlide();
  } else {
    // Fallback: create a frame-based slide
    const frame = figma.createFrame();
    frame.resize(1920, 1080);
    figma.currentPage.appendChild(frame);
    slide = frame;
  }

  if (name) slide.name = name;

  return {
    id: slide.id,
    name: slide.name,
    type: slide.type,
    row: row ?? 0,
    column: column ?? 0,
  };
}

export async function deleteSlide(params: { slideId: string }) {
  const { slideId } = params ?? {};
  if (!slideId) throw new Error('Missing slideId parameter');

  const node = await figma.getNodeByIdAsync(slideId);
  if (!node) throw new Error(`Slide not found with ID: ${slideId}`);

  const info = { id: node.id, name: node.name, deleted: true };
  node.remove();
  return info;
}

export async function cloneSlide(params: { slideId: string }) {
  const { slideId } = params ?? {};
  if (!slideId) throw new Error('Missing slideId parameter');

  const node = await figma.getNodeByIdAsync(slideId);
  if (!node) throw new Error(`Slide not found with ID: ${slideId}`);
  if (!('clone' in node)) throw new Error('Slide node does not support cloning');

  const cloned = (node as SceneNode).clone();

  return {
    originalId: node.id,
    newId: cloned.id,
    newName: cloned.name,
  };
}

export async function focusSlide(params: { slideId: string }) {
  const { slideId } = params ?? {};
  if (!slideId) throw new Error('Missing slideId parameter');

  const node = await figma.getNodeByIdAsync(slideId);
  if (!node) throw new Error(`Slide not found with ID: ${slideId}`);

  if ('type' in node && node.type !== 'DOCUMENT' && node.type !== 'PAGE') {
    const sceneNode = node as SceneNode;
    figma.currentPage.selection = [sceneNode];
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
  }

  return { id: node.id, name: node.name };
}

export async function getFocusedSlide() {
  const selection = figma.currentPage.selection;
  const pageChildIds = new Set(
    figma.currentPage.children.map((c) => c.id)
  );

  for (const selected of selection) {
    // Walk up to find the slide ancestor (direct child of page)
    let current: BaseNode | null = selected;
    while (current && current.parent && current.parent.type !== 'PAGE') {
      current = current.parent;
    }
    if (current && pageChildIds.has(current.id)) {
      return {
        id: current.id,
        name: current.name,
        type: current.type,
      };
    }
  }

  return null;
}

export async function getSlideGrid() {
  await figma.currentPage.loadAsync();
  const slides = figma.currentPage.children;

  const grid = slides.map((slide, index) => {
    const gridPosition =
      'gridPosition' in slide ? (slide as any).gridPosition : null;

    return {
      id: slide.id,
      name: slide.name,
      type: slide.type,
      index,
      row: gridPosition?.row ?? Math.floor(index / 4),
      column: gridPosition?.column ?? index % 4,
    };
  });

  const maxRow = grid.length > 0 ? Math.max(...grid.map((g) => g.row)) : 0;
  const maxCol = grid.length > 0 ? Math.max(...grid.map((g) => g.column)) : 0;

  return {
    totalSlides: slides.length,
    rows: maxRow + 1,
    columns: maxCol + 1,
    grid,
  };
}

export async function getAllSlides() {
  await figma.currentPage.loadAsync();
  const slides = figma.currentPage.children;

  return {
    count: slides.length,
    slides: slides.map((slide, index) => ({
      id: slide.id,
      name: slide.name,
      type: slide.type,
      index,
      width: 'width' in slide ? (slide as SceneNode).width : undefined,
      height: 'height' in slide ? (slide as SceneNode).height : undefined,
    })),
  };
}

export async function setSlideTransition(params: {
  slideId: string;
  type: string;
  direction?: string;
  duration?: number;
  easing?: string;
}) {
  const {
    slideId,
    type,
    direction,
    duration = 300,
    easing = 'EASE_IN_AND_OUT',
  } = params ?? {};
  if (!slideId) throw new Error('Missing slideId parameter');

  const node = await figma.getNodeByIdAsync(slideId);
  if (!node) throw new Error(`Slide not found with ID: ${slideId}`);

  if (!('transition' in node)) {
    throw new Error(
      'This node does not support transitions. Is it a slide?'
    );
  }

  if (type === 'NONE') {
    (node as any).transition = null;
    return { id: node.id, name: node.name, transition: null };
  }

  const transition: any = { type };

  // Directional transitions require a direction
  const directionalTypes = [
    'PUSH',
    'SLIDE_IN',
    'SLIDE_OUT',
    'MOVE_IN',
    'MOVE_OUT',
  ];
  if (directionalTypes.includes(type)) {
    transition.direction = direction || 'LEFT';
  }

  transition.duration = duration;
  transition.easing = { type: easing };

  (node as any).transition = transition;

  return {
    id: node.id,
    name: node.name,
    transition,
  };
}

export async function skipSlide(params: {
  slideId: string;
  skipped: boolean;
}) {
  const { slideId, skipped } = params ?? {};
  if (!slideId) throw new Error('Missing slideId parameter');

  const node = await figma.getNodeByIdAsync(slideId);
  if (!node) throw new Error(`Slide not found with ID: ${slideId}`);

  if ('skipped' in node) {
    (node as any).skipped = skipped;
  } else if ('visible' in node) {
    // Fallback: toggle visibility
    (node as SceneNode).visible = !skipped;
  }

  return {
    id: node.id,
    name: node.name,
    skipped,
  };
}

export async function getSlideProperties(params: { slideId: string }) {
  const { slideId } = params ?? {};
  if (!slideId) throw new Error('Missing slideId parameter');

  const node = await figma.getNodeByIdAsync(slideId);
  if (!node) throw new Error(`Slide not found with ID: ${slideId}`);

  const baseInfo = distillNodeInfo(node);

  const slideSpecific: any = {};
  if ('transition' in node) {
    slideSpecific.transition = (node as any).transition;
  }
  if ('skipped' in node) {
    slideSpecific.skipped = (node as any).skipped;
  }
  if ('gridPosition' in node) {
    slideSpecific.gridPosition = (node as any).gridPosition;
  }

  return {
    ...baseInfo,
    slideSpecific,
  };
}
