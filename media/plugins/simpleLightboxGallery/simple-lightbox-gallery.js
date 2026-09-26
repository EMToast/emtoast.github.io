(function () {
	'use strict';

	var script = document.currentScript;
	var config = {};

	try {
		config = JSON.parse(script && script.getAttribute('data-config') || '{}');
	} catch (error) {
		console.error('Simple Lightbox Gallery: invalid configuration.', error);
		return;
	}

	if (typeof VenoBox === 'undefined') {
		console.error('Simple Lightbox Gallery: VenoBox script not loaded.');
		return;
	}

	var options = config.venobox || {};
	var controls = config.controls || {};
	var labels = config.labels || {};
	var selector = options.selector || '.gallery__item a';
	var activeItem = null;
	var imageProbeId = 0;

	function queryCurrentItem(dialog, preferredItem) {
		var displayedImage = dialog && dialog.querySelector('.vbox-content img');
		if (displayedImage) {
			var displayedURL = displayedImage.currentSrc || displayedImage.src;
			var items = document.querySelectorAll(selector);
			for (var index = 0; index < items.length; index++) {
				if (items[index].href === displayedURL) return items[index];
			}
		}
		return preferredItem;
	}

	function syncFocusableState(control) {
		if (!control) return;
		if (control.classList.contains('vbox-hidden')) {
			control.setAttribute('aria-hidden', 'true');
			control.setAttribute('tabindex', '-1');
		} else {
			control.removeAttribute('aria-hidden');
			if (!control.classList.contains('vbox-close')) control.removeAttribute('tabindex');
		}
	}

	function localizeCopyConfirmation(button) {
		if (!button || button.dataset.slgLocalized === 'true') return;
		button.dataset.slgLocalized = 'true';
		button.addEventListener('click', function () {
			var tooltip = button.querySelector('.vbox-tooltip-text');
			if (!tooltip) return;

			var observer = new MutationObserver(function () {
				if (tooltip.textContent.trim()) {
					tooltip.textContent = labels.copied;
					observer.disconnect();
				}
			});
			observer.observe(tooltip, { childList: true, subtree: true });
			window.setTimeout(function () { observer.disconnect(); }, 1500);
		});
	}

	function enhanceLightbox(preferredItem) {
		var dialog = document.querySelector('.vbox-overlay');
		if (!dialog) return;

		activeItem = queryCurrentItem(dialog, preferredItem || activeItem);
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.setAttribute('aria-label', labels.dialog);

		var closeButton = dialog.querySelector('.vbox-close');
		var previousButton = dialog.querySelector('.vbox-prev');
		var nextButton = dialog.querySelector('.vbox-next');
		if (closeButton) closeButton.setAttribute('aria-label', labels.close);
		if (previousButton) previousButton.setAttribute('aria-label', labels.previous);
		if (nextButton) nextButton.setAttribute('aria-label', labels.next);
		syncFocusableState(previousButton);
		syncFocusableState(nextButton);

		var counter = dialog.querySelector('.vbox-num');
		if (counter) {
			var countMatch = counter.textContent.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
			if (countMatch) counter.textContent = countMatch[1] + labels.counterSeparator + countMatch[2];
			counter.setAttribute('aria-live', 'polite');
		}

		var preloader = dialog.querySelector('.vbox-preloader');
		if (preloader) {
			preloader.setAttribute('role', 'status');
			preloader.setAttribute('aria-live', 'polite');
			preloader.setAttribute('aria-label', labels.loading);
		}

		var displayedImage = dialog.querySelector('.vbox-content img');
		if (displayedImage) {
			var thumbnail = activeItem && activeItem.querySelector('img');
			if (thumbnail && thumbnail.hasAttribute('alt')) {
				displayedImage.alt = thumbnail.alt;
			} else {
				displayedImage.alt = labels.imageAltFallback;
			}
		}

		var shareButton = dialog.querySelector('.vbox-share-mobile');
		if (shareButton) {
			if (controls.share) shareButton.setAttribute('aria-label', labels.share);
			else shareButton.remove();
		}

		var downloadButton = dialog.querySelector('.vbox-share a[download]');
		if (downloadButton) {
			if (controls.download) {
				downloadButton.setAttribute('aria-label', labels.download);
				downloadButton.setAttribute('rel', 'noopener');
			} else {
				downloadButton.remove();
			}
		}

		var copyButton = dialog.querySelector('.vbox-share-copy');
		if (copyButton) {
			if (controls.copyLink && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
				copyButton.setAttribute('aria-label', labels.copyLink);
				localizeCopyConfirmation(copyButton);
			} else {
				var copyWrapper = copyButton.closest('.vbox-tooltip');
				if (copyWrapper) copyWrapper.remove();
				else copyButton.remove();
			}
		}

		var shareContainer = dialog.querySelector('.vbox-share');
		if (shareContainer) {
			shareContainer.classList.toggle('vbox-hidden', !shareContainer.children.length);
		}
	}

	function showImageError(item, probeId) {
		if (probeId !== imageProbeId || item !== activeItem) return;
		var dialog = document.querySelector('.vbox-overlay');
		if (!dialog) return;

		var content = dialog.querySelector('.vbox-content');
		var preloader = dialog.querySelector('.vbox-preloader');
		if (!content) return;

		content.classList.add('slg-load-failed');
		content.replaceChildren();
		var errorMessage = document.createElement('div');
		errorMessage.className = 'vbox-child slg-load-error';
		errorMessage.setAttribute('role', 'alert');
		errorMessage.textContent = labels.loadError;
		content.appendChild(errorMessage);
		if (preloader) preloader.classList.add('vbox-hidden');
	}

	function monitorImage(item) {
		if (!item || item.dataset.vbtype) return;
		activeItem = item;
		var probeId = ++imageProbeId;
		var probe = new Image();
		probe.onload = function () {
			if (probeId !== imageProbeId || item !== activeItem) return;
			var content = document.querySelector('.vbox-content');
			if (content) content.classList.remove('slg-load-failed');
		};
		probe.onerror = function () { showImageError(item, probeId); };
		probe.src = item.href;
	}

	if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		options.initialScale = 1;
		options.transitionSpeed = 0;
		options.navSpeed = 0;
	}

	options.focusItem = true;
	options.navKeyboard = true;
	options.onPreOpen = function (item) {
		activeItem = item;
		monitorImage(item);
		window.setTimeout(function () { enhanceLightbox(item); }, 0);
		return true;
	};
	options.onPostOpen = function (item) {
		activeItem = item;
		enhanceLightbox(item);
	};
	options.onNavComplete = function (item) {
		activeItem = item;
		monitorImage(item);
		enhanceLightbox(item);
	};
	options.onContentLoaded = function () {
		enhanceLightbox(activeItem);
	};

	if (!controls.keyboardNavigation) {
		document.addEventListener('keydown', function (event) {
			if (!document.querySelector('.vbox-overlay')) return;
			if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				event.stopImmediatePropagation();
			}
		}, true);
	}

	var bodyObserver = new MutationObserver(function () {
		if (document.querySelector('.vbox-overlay')) enhanceLightbox(activeItem);
	});
	bodyObserver.observe(document.body, { childList: true });

	new VenoBox(options);
}());
