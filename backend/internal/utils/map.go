package utils

func Map[T any, U any](s []T, mapper func(T) U) []U {
	result := make([]U, len(s))
	for i, v := range s {
		result[i] = mapper(v)
	}
	return result
}
