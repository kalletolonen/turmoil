DIR = /var/www/html/turmoil

.PHONY: build deploy

build:
	npm run build

# Usage: make deploy <user@server>
deploy: build
	$(eval ARGS := $(filter-out deploy,$(MAKECMDGOALS)))
	$(if $(ARGS),,$(error Usage: make deploy <user@server>))
	$(eval HOST := $(ARGS))
	rsync -avz --delete dist/ $(HOST):$(DIR)

# Catch-all to allow the host to be passed as an argument without error
%:
	@:
