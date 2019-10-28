class SpatialDropout2D extends tf.layers.Layer {
	static className = 'SpatialDropout2D';
	constructor() {
		super({});
		this.supportsMasking = true;
	}

	call(inputs) {
		let input = inputs;
		if (Array.isArray(input)) {
			input = input[0];
		}
		var keep_prob = 0.65
		var num_feature_maps = [input.shape[0], input.shape[3]]
		var uniform = tf.randomUniform(num_feature_maps).asType("float32")
		var random_tensor = tf.add(keep_prob,uniform)
		var binary_tensor = tf.floor(random_tensor);
		binary_tensor = tf.reshape(binary_tensor, [-1, 1, 1, input.shape[3]]);
		var ret = tf.mul(tf.div(input, keep_prob), binary_tensor);
		return ret;
	}
}
tf.serialization.SerializationMap.register(SpatialDropout2D);